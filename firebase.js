import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
    getDatabase,
    ref,
    runTransaction,
    onValue
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCK1kw4WAdEn6yRniAP3inrOTKNJEKVq6Y",
    authDomain: "school-election-63e67.firebaseapp.com",
    databaseURL: "https://school-election-63e67-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "school-election-63e67",
    storageBucket: "school-election-63e67.firebasestorage.app",
    messagingSenderId: "283070886500",
    appId: "1:283070886500:web:59969c87c1744cfede2571"
};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

export {
    db,
    ref,
    runTransaction,
    onValue
};