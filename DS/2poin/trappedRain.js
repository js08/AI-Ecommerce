// // 16. Trapping Rain Water
// // Calculate trapped rain water.
// // Input
// // height = [0,1,0,2,1,0,1,3,2,1,2,1]
// // Output
// // 6

// function trappedRainWater(arr) {
//     let totalWater = 0;
//     let left = 0;
//     let maxLeft = 0;
//     let maxRight = 0;
//     let right = arr.length - 1;


//     while (left < right) {
//         if (arr[left] < arr[right]) {
//             if (arr[left] >= maxLeft) {
//                 maxLeft = arr[left];

//             } else {

//                 let waterLevel = maxLeft;
//                 let puddleDepth = waterLevel - arr[left];
//                 totalWater = totalWater + puddleDepth;

//             }

//             left = left + 1;

//         } else {
//             if(arr[right] > maxRight){
//                 maxRight = arr[right];
//             }else{

//             }

//             right = right - 1;


//         }
//     }

//     // for (let right = arr.length - 1; right < arr.length; right++) {
//     //     if (arr[left] > maxLeft) {
//     //         maxLeft = arr[left]

//     //     } else if (true) {
//     //         calRain = maxLeft - arr[left];
//     //         left = left + 1;
//     //     } else {
//     //         right = right - 1;
//     //     }



//     // }


// }

// console.log(trappedRainWater([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]))


import React, {
    useState
} from 'react';
import {
    createRoot
} from 'react-dom/client';

const style = {
    table: {
        borderCollapse: 'collapse'
    },
    tableCell: {
        border: '1px solid gray',
        margin: 0,
        padding: '5px 10px',
        width: 'max-content',
        minWidth: '150px'
    },
    form: {
        container: {
            padding: '20px',
            border: '1px solid #F0F8FF',
            borderRadius: '15px',
            width: 'max-content',
            marginBottom: '40px'
        },
        inputs: {
            marginBottom: '5px'
        },
        submitBtn: {
            marginTop: '10px',
            padding: '10px 15px',
            border: 'none',
            backgroundColor: 'lightseagreen',
            fontSize: '14px',
            borderRadius: '5px'
        }
    }
}

function PhoneBookForm({
    addEntryToPhoneBook
}) {
    return ( <
        form onSubmit = {
            e => {
                e.preventDefault()
            }
        }
        style = {
            style.form.container
        } >
        <
        label > First name: < /label> <
        br / >
        <
        input style = {
            style.form.inputs
        }
        className = 'userFirstname'
        name = 'userFirstname'
        type = 'text' /
        >
        <
        br / >
        <
        label > Last name: < /label> <
        br / >
        <
        input style = {
            style.form.inputs
        }
        className = 'userLastname'
        name = 'userLastname'
        type = 'text' /
        >
        <
        br / >
        <
        label > Phone: < /label> <
        br / >
        <
        input style = {
            style.form.inputs
        }
        className = 'userPhone'
        name = 'userPhone'
        type = 'text' /
        >
        <
        br / >
        <
        input style = {
            style.form.submitBtn
        }
        className = 'submitButton'
        type = 'submit'
        value = 'Add User' /
        >
        <
        /form>
    )
}

function InformationTable(props) {
    return ( <
        table style = {
            style.table
        }
        className = 'informationTable' >
        <
        thead >
        <
        tr >
        <
        th style = {
            style.tableCell
        } > First name < /th> <
        th style = {
            style.tableCell
        } > Last name < /th> <
        th style = {
            style.tableCell
        } > Phone < /th> <
        /tr> <
        /thead> <
        /table>
    );
}

function Application(props) {
    return ( <
        section >
        <
        PhoneBookForm / >
        <
        InformationTable / >
        <
        /section>
    );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render( < Application / > );