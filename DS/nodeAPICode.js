const country = 'India';
async function getTopUniversity() {
    try {
        let apiEndPoint = `http://universities.hipolabs.com/search?country=${country}`;
        const response = await fetch(apiEndPoint);
        const data = await response.json();
        const listWithRanks = data.map((univ, index) => {
            return {
                ...univ,
                rank: Math.floor(Math.random() * 100) + 1
            };
        });
        console.log('listWithRanks --->', listWithRanks);
        let topRank = listWithRanks[0];
        listWithRanks.forEach((currentUniv) => {
            if (currentUniv.rank < topRank.rank) {
                topRank = currentUniv;
            }
        });
        console.log("topRank.rank --->", topRank.rank);
        // 9. Output the final result to the user
        console.log("-----------------------------------------");
        console.log(`Top University found in ${country}:`);
        console.log(`Name: ${topRank.name}`);
        console.log(`Rank: #${topRank.rank}`);
        console.log(`Website: ${topRank.web_pages[0]}`);
        console.log("-----------------------------------------");
    } catch (error) {
        console.log('Fetch failed:', error);
    }
}



console.log('getTopUniversity --->', getTopUniversity());
