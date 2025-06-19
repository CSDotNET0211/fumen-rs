// reverseEventManager.ts

/**
 * カスタムイベントオブジェクトのインターフェース
 * Eventオブジェクトを模倣し、detail、preventDefault、defaultPreventedを持つ
 */
interface IReverseEvent<T = any> {
    detail: T;
    timestamp: string;
    cancelable: boolean; // preventDefaultが呼び出し可能か
    _defaultPrevented: boolean; // 内部的なキャンセル状態

    preventDefault(): void;
    readonly defaultPrevented: boolean;
}

/**
 * リスナー関数の型定義
 */
type ReverseEventListener<T = any> = (event: IReverseEvent<T>) => void;

/**
 * 登録されたイベントリスナーを管理するための内部インターフェース
 */
interface EventListenerEntry<T = any> {
    callback: ReverseEventListener<T>;
    options?: { once?: boolean }; // onceオプションなど将来的な拡張用
}

/**
 * イベントを逆順に発火させるカスタムイベントマネージャークラス
 * @template T イベントのdetailプロパティの型
 */
class ReverseEventManager<T = any> {
    private listeners: EventListenerEntry<T>[] = [];
    private eventName: string; // イベント名を保持 (将来的な拡張性のため)

    constructor(eventName: string = 'customReverseEvent') {
        this.eventName = eventName;
    }

    /**
     * イベントリスナーを登録します。
     * @param callback イベント発生時に実行される関数
     * @param options オプション (例: { once: true } で一度だけ実行)
     */
    addReverseEventListener(callback: ReverseEventListener<T>, options?: { once?: boolean }): void {
        this.listeners.push({ callback, options });
        console.log(`[${this.eventName}] リスナーを登録しました。現在のリスナー数: ${this.listeners.length}`);
    }

    /**
     * 指定されたイベントリスナーを削除します。
     * @param callback 削除するイベントリスナー関数
     */
    removeReverseEventListener(callback: ReverseEventListener<T>): void {
        const initialLength = this.listeners.length;
        this.listeners = this.listeners.filter(entry => entry.callback !== callback);
        if (this.listeners.length < initialLength) {
            console.log(`[${this.eventName}] リスナーを削除しました。現在のリスナー数: ${this.listeners.length}`);
        } else {
            console.log(`[${this.eventName}] 指定されたリスナーは見つかりませんでした。`);
        }
    }

    /**
     * イベントを逆順に発火させます。
     * @param detail イベントに付随するデータ
     * @param cancelable このイベントがキャンセル可能かどうかのフラグ (デフォルト: true)
     * @returns イベントがキャンセルされた場合は `false`、されなかった場合は `true`
     */
    dispatchReverseEvent(detail: T, cancelable: boolean = true): boolean {
        console.log(`[${this.eventName}] --- 逆順イベント発火開始 ---`);

        // Eventオブジェクトを模倣したカスタムイベントインスタンスを作成
        const mockEvent: IReverseEvent<T> = {
            detail: detail,
            timestamp: new Date().toISOString(),
            cancelable: cancelable,
            _defaultPrevented: false, // 初期状態はキャンセルされていない

            preventDefault: function () {
                if (this.cancelable) {
                    this._defaultPrevented = true;
                    console.log(`[${this.eventName}] preventDefault() が呼び出されました。`);
                } else {
                    console.warn(`[${this.eventName}] このイベントはキャンセルできません。`);
                }
            },
            get defaultPrevented() {
                return this._defaultPrevented;
            }
        };

        let isEventPrevented = false;

        // リスナーを逆順でループして実行
        for (let i = this.listeners.length - 1; i >= 0; i--) {
            const entry = this.listeners[i];
            const listener = entry.callback;

            // もし一度だけ実行するオプションが設定されていれば、実行後に削除
            if (entry.options?.once) {
                this.listeners.splice(i, 1); // ここで削除すると、ループのインデックス調整が必要
                // ただし、逆順ループなのでspliceしてもインデックスは壊れない
                // iが減っていくため、削除された要素の後の要素は正しいインデックスでアクセスされる
            }

            try {
                listener(mockEvent);

                // リスナーが preventDefault を呼び出した場合
                if (mockEvent.defaultPrevented) {
                    isEventPrevented = true;
                    // 他のリスナーがキャンセルされたことを知る必要がある場合はここでbreakしない
                    // ただし、以降の「デフォルト動作」を止めるのが目的ならbreakしても良い
                    // 今回は全てのリスナーを実行し、最終的な状態を返す
                }
            } catch (error) {
                console.error(`[${this.eventName}] リスナー実行中にエラーが発生しました:`, error);
            }
        }

        console.log(`[${this.eventName}] --- 逆順イベント発火終了。キャンセル状態: ${isEventPrevented} ---`);
        return !isEventPrevented; // キャンセルされたらfalse、されなかったらtrue
    }
}

// export default ReverseEventManager; // モジュールとして利用する場合