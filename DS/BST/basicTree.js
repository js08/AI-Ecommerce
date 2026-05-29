// 1. Node

// A node is the basic element of a tree that stores:

// data (value)

// reference to the left child

// reference to the right child

// Example:

//     10

// 10 is a node.

// 2. Root

// The root is the topmost node of the tree.

// Example:

//       10
//      /  \
//     5    15

// Root = 10
eft subtree values 
// 3. Parent Node

// A node that has children is called a parent.

// Example:

//       10
//      /  \
//     5    15

// Parent of 5 and 15 is 10.

// 4. Child Node

// Nodes that descend from another node are called children.

// Example:

//       10
//      /  \
//     5    15

// Children of 10 → 5 and 15

// 5. Leaf Node

// A node that has no children.

// Example:

//       10
//      /  \
//     5    15
//          /
//         12

// Leaf nodes → 5, 12

// 6. Internal Node

// Any node that has at least one child.

// Example:

//       10
//      /  \
//     5    15

// Internal nodes → 10

// 7. Subtree

// A tree inside a tree.

// Example:

//       10
//      /  \
//     5    15
//         /  \
//        12   20

// Subtree of 15:

//    15
//   /  \
// 12   20
// 8. Height of Tree

// Number of edges in the longest path from root to leaf.

// Example:

//       10
//      /  \
//     5    15
//          /
//         12

// Height = 2

// 9. Depth of Node

// Number of edges from root to that node.

// Example:

//       10
//      /  \
//     5    15

// Depth of:

// 10 = 0

// 5 = 1

// 15 = 1

// 10. Level

// Nodes with the same depth belong to the same level.

// Example:

// Level 0 → 10
// Level 1 → 5, 15
// Level 2 → children of 5 and 15
// 11. Ancestor

// All nodes above a given node in the path from root.

// Example:

//       10
//      /  \
//     5    15
//          /
//         12

// Ancestors of 12 → 15, 10

// 12. Descendant

// Nodes below a given node.

// Example:

//       10
//      /  \
//     5    15
//          /
//         12

// Descendant of 10 → 5, 15, 12

// 13. Binary Search Tree Property

// For every node:

// L <  Node value
// Right subtree values >  Node value

// Example:

//        10
//       /  \
//      5    15
//     / \     \
//    2   7     20
// 14. Balanced Tree

// A tree where the height difference between left and right subtree is small.

// 15. Skewed Tree

// Left Skewed:

//     10
//    /
//   8
//  /
// 6

// Right Skewed:

// 10
//   \
//    12
//      \
//       15



// Node class
class Node {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

// BST class
class BST {
  constructor() {
    this.root = null;
  }

  // Insert operation
  insert(value) {
    this.root = this.insertNode(this.root, value);
  }

  insertNode(node, value) {

    if (node === null) {
      return new Node(value);
    }

    if (value < node.value) {
      node.left = this.insertNode(node.left, value);
    } 
    else if (value > node.value) {
      node.right = this.insertNode(node.right, value);
    }

    return node;
  }

  // Find minimum value
  findMin(node) {
    while (node.left !== null) {
      node = node.left;
    }
    return node;
  }

  // Delete operation
  delete(value) {
    this.root = this.deleteNode(this.root, value);
  }

  deleteNode(node, value) {

    if (node === null) {
      return null;
    }

    if (value < node.value) {
      node.left = this.deleteNode(node.left, value);
    } 
    else if (value > node.value) {
      node.right = this.deleteNode(node.right, value);
    } 
    else {

      // Case 1: No child
      if (node.left === null && node.right === null) {
        return null;
      }

      // Case 2: One child
      if (node.left === null) {
        return node.right;
      }

      if (node.right === null) {
        return node.left;
      }

      // Case 3: Two children
      let successor = this.findMin(node.right);
      node.value = successor.value;

      node.right = this.deleteNode(node.right, successor.value);
    }

    return node;
  }

  // Inorder traversal
  inorder(node = this.root) {

    if (node === null) return;

    this.inorder(node.left);
    console.log(node.value);
    this.inorder(node.right);
  }
}


// Driver Code

let tree = new BST();

// Insert nodes
tree.insert(10);
tree.insert(5);
tree.insert(15);
tree.insert(2);
tree.insert(7);
tree.insert(12);
tree.insert(20);

console.log("Inorder traversal (sorted BST):");
tree.inorder();


// Delete a node
tree.delete(10);

console.log("\nAfter deleting 10:");
tree.inorder();


Successors, predecessor, descendants
Width, height, depths of bst

