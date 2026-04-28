// 1. Define the country we want to search for
const country = "India";

// 2. The API endpoint that gives us a list of universities by country
const apiEndpoint = `http://universities.hipolabs.com/search?country=${country}`;

// 3. We create an 'async' function so we can wait for the API response
async function getTopUniversity() {
    try {
        // 4. Call the API and wait for the data to arrive
        console.log(`Fetching universities for ${country}...`);
        const response = await fetch(apiEndpoint);

        // 5. Convert the raw response into a JSON list (an array of objects)
        const universities = await response.json();

        // Check if we actually got any results back
        if (universities.length === 0) {
            console.log("No universities found for this country.");
            return;
        }

        /**
         * 6. IMPORTANT: Most free APIs don't have a 'rank' field.
         * For this exercise, we will add a mock 'rank' to the data 
         * so we can demonstrate how to find the "Top" one.
         */
        const listWithRanks = universities.map((uni, index) => {
            return {
                ...uni,
                // Assigning a random rank for demonstration (1 is best)
                rank: Math.floor(Math.random() * 100) + 1
            };
        });

        // 7. Iterate through the list to find the university with the "Top Rank"
        // We initialize with the first university in the list

        console.log(" listWithRanks[0] --->", listWithRanks);
        let topUniversity = listWithRanks[0];

        // 8. Loop through each university to compare ranks
        listWithRanks.forEach((currentUni) => {
            // In ranking, a smaller number (like 1) is better than a larger one (like 50)
            if (currentUni.rank < topUniversity.rank) {
                // If we find a better rank, update our 'topUniversity' variable
                topUniversity = currentUni;
            }
        });

        // 9. Output the final result to the user
        console.log("-----------------------------------------");
        console.log(`Top University found in ${country}:`);
        console.log(`Name: ${topUniversity.name}`);
        console.log(`Rank: #${topUniversity.rank}`);
        console.log(`Website: ${topUniversity.web_pages[0]}`);
        console.log("-----------------------------------------");

    } catch (error) {
        // 10. If something goes wrong (like no internet), catch the error here
        console.error("Error fetching data:", error.message);
    }
}

// 11. Run the function
getTopUniversity();