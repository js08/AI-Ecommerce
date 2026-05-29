public class firtsOccurence {

    private static class BSTNode {
        int value;
        int index;
        BSTNode left;
        BSTNode right;

        BSTNode(int value, int index) {

            this.value = value;
            this.index = index;
            this.left = null;
            this.right = null;

        }

    }

    private BSTNode root;

    public BinarySearchTree(){
        this.root = null;
    }

    public void insert(int value, int index) {
        BSTNode newNode = new BSTNode(value, index);

        if(this.root == null){
            this.root = newNode;
            return;
        }
    }

}
