import { Group } from "../model/Group";

export interface GroupRepository {
    findById(id: string): Group | undefined;
    save(group: Group): void;
}
