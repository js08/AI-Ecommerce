import java.util.*;

public class Main {

    public static List<Integer> firstNegative(int[] arr, int k) {
        List<Integer> result = new ArrayList<>();

        LinkedList<Integer> queue = new LinkedList<>();

        for (int i = 0; i < k - 1; i++) {
            if (arr[i] < 0) {
                queue.addLast(i);

            }
        }

        for (int i = k - 1; i < arr.length; i++) {
            if (arr[i] < 0) {
                queue.addLast(i);
                // addLast(i): This is exactly like push(). It puts the newcomer at the back of
                // the line.
                // pollFirst(): This is exactly like shift(). It takes the person at the front
                // of the line and removes them.

                // peekFirst(): This is like checking queue[0]. It lets you look at the person
                // at the front without making them leave the line.
            }

            if (!queue.isEmpty() && queue.peekFirst <= i - k) {

                queue.PollFirst();

            }

            if (!queue.isEmpty()) {

                result.add(arr[queue.peekFirst()]);

            } else {
                result.add(0);

            }
        }

        return result;

    }

    public static void main(String[] args) {

    }

}