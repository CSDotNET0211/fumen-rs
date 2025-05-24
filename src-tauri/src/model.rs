use candle_core::{op, DType, IndexOp, Shape, Tensor};
use candle_nn::ops::softmax;
use candle_nn::AdamW;
use candle_nn::{linear, loss::cross_entropy, Linear, Module, Optimizer, VarBuilder, VarMap};
use rand::seq::SliceRandom;
use rand::Rng;

use crate::model;

pub struct Model {
    fc1: Linear,
    fc2: Linear,
    fc3: Linear,
    fc4: Linear,
    fc5: Linear,
    fc6: Linear,
    fc7: Linear,
    fc8: Linear,
    //  fc9: Linear,
    pub varmap: VarMap,
}

impl Model {
    pub fn new(vb: &VarBuilder) -> candle_core::Result<Self> {
        Ok(Self {
            fc1: linear(3, 64, vb.pp("fc1"))?,
            fc2: linear(64, 64, vb.pp("fc2"))?,
            fc3: linear(64, 64, vb.pp("fc3"))?,
            fc4: linear(64, 128, vb.pp("fc4"))?,
            fc5: linear(128, 1024, vb.pp("fc5"))?,
            fc6: linear(1024, 512, vb.pp("fc6"))?,
            fc7: linear(512, 256, vb.pp("fc7"))?,
            fc8: linear(256, 2, vb.pp("fc8"))?,
            /*  fc6: linear(1088, 512, vb.pp("fc6"))?,
            fc7: linear(512, 256, vb.pp("fc7"))?,
            fc8: linear(256, 128, vb.pp("fc8"))?,
            fc9: linear(128, 2, vb.pp("fc9"))?,*/
            varmap: VarMap::new(),
        })
    }

    // 新しいコンストラクタ: varmapを受け取る
    pub fn from_varmap(varmap: VarMap, device: &candle_core::Device) -> candle_core::Result<Self> {
        let vb = VarBuilder::from_varmap(&varmap, DType::F32, device);
        let mut model = Self::new(&vb)?;
        model.varmap = varmap;
        Ok(model)
    }

    pub fn forward(&self, input: &Tensor) -> candle_core::Result<Tensor> {
        let num_points = input.dims()[0];
        let x = self.fc1.forward(input)?.relu()?;
        let x = self.fc2.forward(&x)?.relu()?;
        let local_feature = x.clone();
        let x = self.fc3.forward(&x)?.relu()?;
        let x = self.fc4.forward(&x)?.relu()?;
        let x = self.fc5.forward(&x)?.relu()?;
        let max_pooled = x.max(1)?;
        let max_pooled = max_pooled.unsqueeze(0).unwrap();
        /*     let merged = Tensor::cat(
            &[&local_feature, &max_pooled.expand((num_points, 1024))?],
            1,
        )?;*/
        dbg!(max_pooled.shape());
        let x = self.fc6.forward(&max_pooled)?.relu()?;
        let x = self.fc7.forward(&x)?.relu()?;
        let x = self.fc8.forward(&x)?;
        // let x = self.fc9.forward(&x)?;
        Ok(x)
    }

    pub fn train_step(
        &self,
        input: &Tensor,
        target: &Tensor,
        optimizer: &mut AdamW,
    ) -> candle_core::Result<f32> {
        dbg!(input.shape()); //8,200,3
        let logits = self.forward(input)?;
        dbg!(logits.shape()); //8,2
        let loss = cross_entropy(&logits, target)?;
        loss.backward().unwrap();
        optimizer.backward_step(&loss)?;

        Ok(loss.to_vec0::<f32>()?)
    }

    /// 1次元配列 [x0, y0, z0, x1, y1, z1, ...] を shape=(N,3) のTensorに変換
    pub fn pointcloud_from_flat(
        flat: &[f32],
        device: &candle_core::Device,
    ) -> candle_core::Result<Tensor> {
        let num_points = flat.len() / 3;
        Tensor::from_vec(flat.to_vec(), (num_points, 3), device)
    }

    /// モデルの重みを保存
    pub fn save(&self, path: &str) -> candle_core::Result<()> {
        self.varmap.save(path)
    }

    /// モデルの重みを読み込み
    pub fn load(path: &str, device: &candle_core::Device) -> candle_core::Result<Self> {
        let mut varmap = VarMap::new();
        varmap.load(path)?;
        Self::from_varmap(varmap, device)
    }

    /// values: Vec<String>（各要素はカンマ区切りの "x,y,z" 形式）, targets: Vec<f32>（クラスラベル）
    pub fn train(&mut self, values: Vec<Vec<f32>>) {
        let device = candle_core::Device::Cpu;

        // let varmap = VarMap::new(); // ← 削除
        let params = candle_nn::ParamsAdamW {
            lr: 1e-3,
            beta1: 0.9,
            beta2: 0.999,
            eps: 1e-8,
            weight_decay: 0.01,
        };
        let mut optimizer = AdamW::new(self.varmap.all_vars(), params).unwrap();

        const BATCH_SIZE: usize = 8;
        const CLOUD_SIZE: usize = 200;
        const TRAIN_STEPS: usize = 100;

        //let len = values[0].len();

        let mut rng = rand::thread_rng();

        // cloudデータとターゲットを作る関数
        fn make_cloud(
            values: &Vec<Vec<f32>>,
            rng: &mut impl rand::Rng,
            cloud_size: usize,
        ) -> (Vec<f32>, u8, usize) {
            // ランダムにタイプを選択
            let type_index = rng.gen_range(0..values.len());
            let len = values[type_index].len();

            // そのランダムで選択したタイプのデータをランダムに選択
            let num_points = len / 3;
            let mut indices: Vec<usize> = (0..num_points).collect();
            indices.shuffle(rng);
            let cloud_indices = &indices[..cloud_size];

            let cloud_values: Vec<f32> = cloud_indices
                .iter()
                .flat_map(|&i| {
                    let start = i * 3;
                    values[type_index][start..start + 3].to_vec()
                })
                .collect();
            let cloud_target: u8 = type_index as u8;
            (cloud_values, cloud_target, type_index)
        }

        for epoch in 0..TRAIN_STEPS {
            // バッチサイズ分だけcloudを生成
            let mut cloud_values: Vec<f32> = Vec::with_capacity(CLOUD_SIZE);
            let mut cloud_targets: Vec<u8> = Vec::with_capacity(BATCH_SIZE);

            for _ in 0..CLOUD_SIZE {
                let (new_cloud_values, new_cloud_target, _type_index) =
                    make_cloud(&values, &mut rng, CLOUD_SIZE);
                cloud_values.extend(new_cloud_values);
                cloud_targets.push(new_cloud_target);
            }

            // [BATCH_SIZE, CLOUD_SIZE, 3] のTensorに変換
            //8,200,3
            // let num_points = cloud_values.len() / (8 * 3);
            //  let flat: Vec<f32> = cloud_values.into_iter().flatten().collect();
            let cloud_tensor =
                Tensor::from_vec(cloud_values, (BATCH_SIZE, CLOUD_SIZE, 3), &device).unwrap();
            let target_tensor = Tensor::from_vec(cloud_targets, (BATCH_SIZE,), &device).unwrap();

            dbg!(cloud_tensor.shape());
            dbg!(target_tensor.shape());

            let loss = self
                .train_step(&cloud_tensor, &target_tensor, &mut optimizer)
                .unwrap();
            println!("Epoch: {}, Avg Loss: {:?}", epoch, loss);
        }

        self.save("model.bin").unwrap();
    }

    /// 推論関数: 点群データ(Vec<f32>)を受け取り、softmax後のVec<f32>を返す
    pub fn predict(&self, point_cloud: &Vec<f32>) -> candle_core::Result<Vec<f32>> {
        let device = candle_core::Device::Cpu;
        let num_points = point_cloud.len() / 3;
        let point_cloud_tensor = Tensor::from_vec(point_cloud.clone(), (num_points, 3), &device)?;
        let logits = self.forward(&point_cloud_tensor)?;
        dbg!(logits.shape());
        dbg!(logits.flatten(0, 1).unwrap().to_vec1::<f32>().unwrap());
        let softmax = softmax(&logits, 1)?;
        dbg!(softmax.shape());
        let softmax_flat = softmax.flatten(0, 1)?;
        dbg!(softmax_flat.shape());
        softmax_flat.to_vec1()
    }
}

impl Default for Model {
    fn default() -> Self {
        let varmap = VarMap::new();
        let device = candle_core::Device::Cpu;
        let vb = VarBuilder::from_varmap(&varmap, DType::F32, &device);
        let mut model = Model::new(&vb).unwrap();
        model.varmap = varmap;
        model
    }
}

pub fn test(point_cloud: &Vec<f32>) {
    let device = candle_core::Device::Cpu;
    let num_points = point_cloud.len() / 3;
    let point_cloud_tensor =
        Tensor::from_vec(point_cloud.clone(), (num_points, 3), &device).unwrap();

    let model = Model::default();
    //let vb = VarBuilder::from_varmap(&varmap, DType::F32, &device);

    // let mut model = Model::new(&vb).unwrap();
    // ダミーターゲット（例: 全て0クラス）
    let target = Tensor::zeros((num_points,), DType::U32, &device).unwrap();

    // forward
    let logits = model.forward(&point_cloud_tensor).unwrap();
    let softmax = softmax(&logits, 0).unwrap();
    println!("Result Shape: {:?}", softmax.shape());
    let result: Vec<f32> = softmax.to_vec1().unwrap();
    println!("Result: {:?}", result);

    // 学習例
    let params = candle_nn::ParamsAdamW {
        lr: 1e-3,
        beta1: 0.9,
        beta2: 0.999,
        eps: 1e-8,
        weight_decay: 0.01,
    };
    let mut optimizer = AdamW::new(model.varmap.clone().all_vars(), params).unwrap();

    let loss = model
        .train_step(&point_cloud_tensor, &target, &mut optimizer)
        .unwrap();
    println!("Loss: {:?}", loss);

    // 推論関数の利用例
    let pred = model.predict(point_cloud).unwrap();
    println!("Predict: {:?}", pred);
}

#[cfg(test)]
mod tests {
    use super::*;
    use candle_core::Device;

    #[test]
    fn test_training_progress() {
        let device = Device::Cpu;
        let num_points = 64;
        // ダミー点群データ: [x0, y0, z0, x1, y1, z1, ...]
        let mut point_cloud = Vec::with_capacity(num_points * 3);
        for i in 0..num_points {
            point_cloud.push(i as f32);
            point_cloud.push((i * 2) as f32);
            point_cloud.push((i * 3) as f32);
        }
        // ダミーターゲット: 0~8のクラスを繰り返し
        let mut target_vec = Vec::with_capacity(num_points);
        for i in 0..num_points {
            target_vec.push((i % 9) as u32);
        }

        let point_cloud_tensor = Model::pointcloud_from_flat(&point_cloud, &device).unwrap();
        let target = Tensor::from_vec(target_vec, (num_points,), &device).unwrap();

        let varmap = VarMap::new();
        let vb = VarBuilder::from_varmap(&varmap, DType::F32, &device);
        let model = Model::new(&vb).unwrap();

        let params = candle_nn::ParamsAdamW {
            lr: 1e-2,
            beta1: 0.9,
            beta2: 0.999,
            eps: 1e-8,
            weight_decay: 0.0,
        };
        let mut optimizer = AdamW::new(varmap.all_vars(), params).unwrap();

        let mut losses = Vec::new();
        for _ in 0..10 {
            let loss = model
                .train_step(&point_cloud_tensor, &target, &mut optimizer)
                .unwrap();
            losses.push(loss);
            println!("Current Losses: {:?}", loss);
        }
        println!("Losses: {:?}", losses);

        // 損失が減少していることを確認
        assert!(losses.last().unwrap() < &losses[0], "Loss did not decrease");
    }
}
