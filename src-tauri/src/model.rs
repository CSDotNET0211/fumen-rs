use candle_core::{DType, Shape, Tensor};
use candle_nn::ops::softmax;
use candle_nn::AdamW;
use candle_nn::{linear, loss::cross_entropy, Linear, Module, Optimizer, VarBuilder, VarMap};

pub struct Model {
    fc1: Linear,
    fc2: Linear,
    fc3: Linear,
    fc4: Linear,
    fc5: Linear,
    fc6: Linear,
    fc7: Linear,
    fc8: Linear,
    fc9: Linear,
}

impl Model {
    pub fn new(vb: &VarBuilder) -> candle_core::Result<Self> {
        Ok(Self {
            fc1: linear(3, 64, vb.pp("fc1"))?,
            fc2: linear(64, 64, vb.pp("fc2"))?,
            fc3: linear(64, 64, vb.pp("fc3"))?,
            fc4: linear(64, 128, vb.pp("fc4"))?,
            fc5: linear(128, 1024, vb.pp("fc5"))?,
            fc6: linear(1088, 512, vb.pp("fc6"))?,
            fc7: linear(512, 256, vb.pp("fc7"))?,
            fc8: linear(256, 128, vb.pp("fc8"))?,
            fc9: linear(128, 9, vb.pp("fc9"))?,
        })
    }

    pub fn forward(&self, input: &Tensor) -> candle_core::Result<Tensor> {
        let num_points = input.dims()[0];
        let x = self.fc1.forward(input)?.relu()?;
        let x = self.fc2.forward(&x)?.relu()?;
        let local_feature = x.clone();
        let x = self.fc3.forward(&x)?.relu()?;
        let x = self.fc4.forward(&x)?.relu()?;
        let x = self.fc5.forward(&x)?.relu()?;
        let max_pooled = x.max(0)?;
        let merged = Tensor::cat(
            &[&local_feature, &max_pooled.expand((num_points, 1024))?],
            1,
        )?;
        let x = self.fc6.forward(&merged)?.relu()?;
        let x = self.fc7.forward(&x)?.relu()?;
        let x = self.fc8.forward(&x)?.relu()?;
        let x = self.fc9.forward(&x)?.relu()?;
        Ok(x)
    }

    pub fn train_step(
        &self,
        input: &Tensor,
        target: &Tensor,
        optimizer: &mut AdamW,
    ) -> candle_core::Result<f32> {
        let logits = self.forward(input)?;
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
    pub fn save(varmap: &VarMap, path: &str) -> candle_core::Result<()> {
        varmap.save(path)
    }

    /// モデルの重みを読み込み
    pub fn load(path: &str, device: &candle_core::Device) -> candle_core::Result<(Self, VarMap)> {
        let mut varmap = VarMap::new();
        varmap.load(path)?;
        let vb = VarBuilder::from_varmap(&varmap, DType::F32, device);
        let model = Model::new(&vb)?;
        Ok((model, varmap))
    }
}

pub fn test(point_cloud: &Vec<f32>) {
    let device = candle_core::Device::Cpu;
    let num_points = point_cloud.len() / 3;
    let point_cloud_tensor =
        Tensor::from_vec(point_cloud.clone(), (num_points, 3), &device).unwrap();

    let varmap = VarMap::new();
    let vb = VarBuilder::from_varmap(&varmap, DType::F32, &device);

    let model = Model::new(&vb).unwrap();

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
    let mut optimizer = AdamW::new(varmap.all_vars(), params).unwrap();

    let loss = model
        .train_step(&point_cloud_tensor, &target, &mut optimizer)
        .unwrap();
    println!("Loss: {:?}", loss);
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
