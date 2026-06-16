export class PriorityQueue<T> {
    private elements: T[] = [];
    private comparator: (a: T, b: T) => number;

    constructor(comparator: (a: T, b: T) => number) {
        this.comparator = comparator;
    }

    offer(item: T): void {
        this.elements.push(item);
        this.elements.sort(this.comparator);
    }

    poll(): T | undefined {
        return this.elements.shift();
    }

    isEmpty(): boolean {
        return this.elements.length === 0;
    }
}
