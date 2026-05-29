// 2. First Occurrence of Element
// Given a sorted array that may contain duplicate elements, find the index of the first occurrence of a target value. Your solution must not scan linearly.
// Input:
// arr = [2, 4, 4, 4, 6, 8]
// target = 4
// Output:
// 1


class BSTNode {

    constructor(value, index) {
        this.value = value;
        this.index = index;
        this.left = null;
        this.right = null;


    }

}


class BinarySearchTree {

    constructor() {
        this.root = null;
    }

    insert(value, index) {

        const newNode = new BSTNode(value, index);

        if (!this.root) {
            this.root = newNode;
            return;
        }

        this._insertNode(this.root, newNode);

    }

    _insertNode(node, newNode) {

        if (newNode.value <= node.value) {

            if (!node.left) {
                node.left = newNode;
            } else {
                this._insertNode(node.left, newNode);
            }

        } else {
            if (!node.right) {
                node.right = newNode;
            } else {
                this._insertNode(node.right, newNode);
            }
        }

    }

    findFirstOccurrence(target) {

        let current = this.root;
        let firstIndex = -1;

        while (current !== null) {
            if (current.value === target) {
                if (firstIndex === -1) {
                    firstIndex = current.index;
                }
                current = current.left;
            } else if (target < current.value) {

                current = current.left;

            } else {
                current = current.right;
            }

        }

        return firstIndex;

    }



}

const arr = [2, 4, 4, 4, 6, 8];
const target = 4;

const bst = new BinarySearchTree();
arr.forEach((val, index) => bst.insert(val, index));


const outputIndex = bst.findFirstOccurrence(target);
console.log("outputIndex", outputIndex);