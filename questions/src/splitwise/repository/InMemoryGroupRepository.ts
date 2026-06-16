import { Group } from "../model/Group";
import type { GroupRepository } from "./GroupRepository";

export class InMemoryGroupRepository implements GroupRepository {
    private readonly store: Map<string, Group> = new Map();

    findById(id: string): Group | undefined {
        return this.store.get(id);
    }

    save(group: Group): void {
        this.store.set(group.id, group);
    }
}
