import { TextDatabaseNode } from "./textDatabaseNode";
import { FieldDatabaseNode } from "./fieldDatabaseNode";
// ...import other node types as needed...

export function resolveDatabaseNode(obj: any) {
	switch (obj.type) {
		case "text":
			return new TextDatabaseNode(
				obj.id,
				obj.x,
				obj.y,
				obj.text,
				obj.size,
				obj.color,
				obj.backgroundColor
			);
		case "field":
			return new FieldDatabaseNode(
				obj.id,
				obj.x,
				obj.y,
				obj.thumbnail,
				obj.data,
				obj.hash
			);
		default:
			throw new Error(`Unknown node type: ${obj.type}`);
	}
}
