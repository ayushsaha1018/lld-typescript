export class User {
    constructor(
        public readonly id: string,
        public readonly name: string
    ) {}

    toString(): string {
        return `User(id=${this.id}, name=${this.name})`;
    }
}
