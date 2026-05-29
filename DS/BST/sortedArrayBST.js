class TreeNode {
    constructor(value, index) {
        this.value = value;
        this.index = index;
        this.left = null;
        this.right = null;
    }
}

function sortedArrayToBST(arr, start, end) {

    if (start > end) return null;
    let mid = Math.floor((start + end) / 2);

    let node = new TreeNode(arr[mid], mid);
    node.left = sortedArrayToBST(arr, start, mid - 1);
    node.right = sortedArrayToBST(arr, mid + 1, end);

    return node;

}


function searchBST(root, target) {
    if (root === null) return -1;

    if (root.value === target) {
        return root.index;
    }

    if (target < root.value) {
        return searchBST(root.left, target);
    } else {

        return searchBST(root.right, target);

    }
}





const arr = [10, 20, 30, 40, 50];
const target = 30;


const bstRoot = sortedArrayToBST(arr, 0, arr.length - 1);

const resultIndex = searchBST(bstRoot, target);

console.log(resultIndex);