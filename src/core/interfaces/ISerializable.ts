export interface ISerializable {
	serialize(): string;
	deserialize(data: string): this;
}