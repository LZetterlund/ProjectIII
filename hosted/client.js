"use strict";
let canvas;
let ctx;
let firstCanvas;
let firstCtx;
let secondCanvas;
let secondCtx;
let dragging = false;
let user;
let isVoter = false;
let maxInk = 200;
let currentInk = maxInk;
let outOfInk = false;
let inkwell;
let socket;
//to check whether a given person in a room is also in that game
let isInGame = false;
//make the first canvas to be shown first
let isFirstShown = false;
let secondHasBeenShown = false;
//html things
let enterRoomButton;
let room;
let roomTextBox;
let userTextBox;
let guess;
let enterGuessButton;
let guessTextBox;
let score = 0;
let chatBox;
let timerStarted = false;
let leaderboardTracker = {};
let initiateLobbyButton;
let initiateNewRoundButton;

const socketOn = () => {
    //errors from server
    socket.on('lobbyTaken', (data) => {
        console.log("Lobby is taken: " + room);
        rejectedFromGame();
    });
    
    socket.on('lobbyHasStarted', () => {
        console.log("Their game has started " + room + isInGame);
        if(isInGame == false){
            lobbyHasStarted();
        }
    });
    
    socket.on('notEnoughPlayers', (membersInLobby) => {
       document.getElementById("loadingMessage").innerHTML = "Lobby has " + membersInLobby + " players, you need at least 3.";  
    });

    //gameplay things
    socket.on('populateLeaderboard', () => {
       populateLeaderboard(); 
    });

    socket.on('newRound', (data) => {
       prepareNewRound(data); 
    });

    socket.on('nextDrawing', (data) => {
       nextDrawing(data); 
    });

    socket.on('displayLeaderboard', (data) => {
       displayLeaderboard(data); 
    });

    socket.on('setPlayers', (data) => {
       playerPlacemats(data); 
    });
    
    socket.on('drawCanvas', (data) => {
        console.log(data);
        handleMessage(data);
    });

    socket.on('updateChatroom', (data) => {
       updateChatroom(data); 
    });

    socket.on('loadingScreen', () => {
       loadingScreen(5); 
    });
};

//rejected from lobby, their game started
const lobbyHasStarted = () => {
        //back to lobby select
        rejectedFromGame();
};

//prepares yourself and others for a new game
const initiateNewRound = () => {
    const data = { userID: user, roomID: room };
    socket.emit('initiateNewRound', data);
};

//called at the start of a new round to reset
const prepareNewRound = (data) => {
    //some css stuff
    initiateLobbyButton.style.visibility = "none";
    enterRoomButton.style.display = 'none';  
    document.getElementById("loadingMessage").style.display = "inline";
    document.getElementById("instructions").style.display = "inline";
    initiateNewRoundButton.style.visibility = "hidden";
    document.getElementById("answer").style.display = "none";
    document.getElementById("loadingMessage").innerHTML = "Starting soon...";
    guessTextBox.disabled = false;
    guessTextBox.placeholder = "Enter Guess:";
    //reset all canvases, ink, and view shifters, timers, and leaderboard
    setCanvases();
    secondCanvas.style.top = "-600px";
    secondCanvas.style.left = "300px";
    firstCanvas.style.top = "-600px";
    firstCanvas.style.left = "300px";
    timerStarted = false;
    startTimers(0);
    document.getElementById("gameCover").style.display = "block";
    document.getElementById("leaderboard").style.display = "none";
    document.getElementById("fakeVertisment").style.display = "none";
    //add a new game announcement to the chatbox
    var p = document.createElement("p");
    var node = document.createTextNode("New round started! Good Luck!");
    p.appendChild(node);

    chatBox.appendChild(p);
    scrollChat();
    //after everything reset send start new game request to server (IF YOU'RE THE ONE WHO SENT THE REQUEST, so only 1 game is started)
    if(data.userID == user){
        //if starting new game from verified old lobby send true
        const isVerified = true;
        initiateLobby(isVerified);
    }
}

//called when player attempts to join a room
const enterRoom = () => {
    setCanvases();
    user = document.getElementById("username").value;
    room = document.getElementById("room").value;
    //if username field is left blank, default to username "Player"
    if(user == "") {user = "Player";}
    console.log("username: " + user);
    //add numbers to the end to ensure seperate usernames
    user = user + `${(Math.floor((Math.random()*10000)) + 1)}`;
    console.log("username: " + user);
    console.log(room);
    if(room != null){
        const data = { userID: user, roomID: room };
        socket.emit('join', data);
    }
    //enter the lobby (or get kicked out)
    lobbyPlacemat();
};

//attempts to initiate client's current lobby
const initiateLobby = (isVerified) => {
    const data = { userID: user, roomID: room, verifiedPlayer: isVerified };
    socket.emit('initiateLobby', data);
    console.log("Sent lobby start request");
};

//the countdown called at the beginning of the game to signal a start
const loadingScreen = (timeRemaining) => {
    document.getElementById("instructions").style.display = "inline";
    isInGame = true;
    if(timeRemaining > 0){
        console.log(timeRemaining);
        document.getElementById("loadingMessage").innerHTML = "Starting in " + timeRemaining + "...";
        timeRemaining--;
        setTimeout(function(){ loadingScreen(timeRemaining) }, 1000);
    }
    else{
        document.getElementById("loadingMessage").innerHTML = "Starting...";
        document.getElementById("instructions").style.display = "none";
        startTimers(40);
    }
};

//begin the viewers' and drawers' round timers
const startTimers = (timerNum) => {
    const gameTimer = 0;
    if(timerNum > 0){
        //console.log(timerNum + " timer")
        document.getElementById("countdownTimer").innerHTML = timerNum + "s left";
        timerNum--;
        setTimeout(function(){ startTimers(timerNum) }, 1000);
    }
    else{
        console.log("timer ran out")
        clearTimeout(gameTimer);
    }
};

//begins to throw down
const nextDrawing = (data) => {
    //checks to see if the client is a voter
    if(isVoter == true){
        //if the first canvas isn't shown drop it into place
        if(isFirstShown == false && secondHasBeenShown == false){
            firstCanvas.style.transform = "translate(0px, 750px)";
            firstCanvas.style.visibility = "visible";
            isFirstShown = true;
        }
        //if the second canvas has been shown, but the first isn't on screen right now, rotate
        else if(isFirstShown == false){
            secondCanvas.style.transform = "translate(-2000px, 750px)";
            firstCanvas.style.transform = "translate(0px, 750px)";
            firstCanvas.style.visibility = "visible";
            setTimeout(function(){secondCanvas.style.visibility = "hidden";
                                 secondCanvas.style.transform = "translate(0, 0)";
                                 }, 1500);
            isFirstShown = true;
        }
        //if the first canvas IS shown, slide it out of sight and drop the second canvas in
        else {
            firstCanvas.style.transform = "translate(-2000px, 750px)";
            secondCanvas.style.transform = "translate(0px, 750px)";
            secondCanvas.style.visibility = "visible";
            setTimeout(function(){firstCanvas.style.visibility = "hidden";
                                 firstCanvas.style.transform = "translate(0, 0)";
                                 }, 1500);
            isFirstShown = false;
            secondHasBeenShown = true;
        }

        guessTextBox.style.visibility = "visible";
    }
    else{
        document.getElementById("answer").style.display = "inline";
        document.getElementById("answer").innerHTML = "Draw: " + data.answerID;
    }

    document.getElementById("gameCover").style.display = "none";
    document.getElementById("loadingMessage").style.display = "none";
    document.getElementById("instructions").style.display = "none";
    document.getElementById("leaderboard").style.display = "none";
    document.getElementById("fakeVertisment").style.display = "none";
    //startTimers();
};

//update the chat with wrong answers and correct users
const updateChatroom = (data) => {
    //if this guess was right, check if this client gets points
    if(data.isGuessCorrect){
        var p = document.createElement("p");
        //if this client is the one who guessed it, repleace their name to let them know!
        if(data.userID == user) {
            correctAnswer();
            var node1 = document.createTextNode("You got the answer!");
        } else
        var node1 = document.createTextNode(data.userID + " got the answer!");
        var br = document.createElement("br");
        if(data.drawerID == user) {
            score = score + 10;
            var node2 = document.createTextNode("You were the helpful artist, have some points!");
        } else
        var node2 = document.createTextNode(data.drawerID + " was the artist during the guess!");
        p.appendChild(node1);
        p.appendChild(br);
        p.appendChild(node2);

        chatBox.appendChild(p);
        scrollChat();
    }
    else{
        var p = document.createElement("p");
        var node = document.createTextNode(data.userID + ": " + data.wrongAnswer);
        p.appendChild(node);

        chatBox.appendChild(p);
        scrollChat();
    }
};

//when a voter gets it right, let them know and disable the text box
const correctAnswer = () => {
    guessTextBox.placeholder = "Correct!";
    guessTextBox.disabled = true;
    enterGuessButton.style.visibility = "hidden";
    score = score + 10;
}

//keeps the chatBox scrolled to the bottom
const scrollChat = () => {
    chatBox.scrollTop = chatBox.scrollHeight;
}

//submits the players answer for evaluation by the server
const submitAnswer = () => {
    guess = guessTextBox.value;
    const data = { userID: user, roomID: room, guessID: guess };
    socket.emit('submitAnswer', data);
    guessTextBox.value = null;
};

//method to make sure canvases are not blank after game has started
const setCanvases = () => {
    //fix canvases
    firstCtx.fillStyle="white";
    firstCtx.fillRect(0,0,900, 600);

    secondCtx.fillStyle="white";
    secondCtx.fillRect(0,0,900, 600);

    ctx.fillStyle="white";
    ctx.fillRect(0,0,900, 600);
    //fix ink
    currentInk = maxInk + 1;
    useInk();
    //fix rotating canvases
    isFirstShown = false;
    secondHasBeenShown = false;
}

//changing the UI so voters and artists have seperate experiences
const playerPlacemats = (data) => {
    //check to see if this client is an artist
    if(data.second == user || data.first == user) {
        artistPlacemat();
    }
    //set this screen if they are a voter
    if(data.first != user && data.second != user) {
        voterPlacemat();
    }
    document.getElementById("countdownTimer").style.visibility = "visible";
    initiateLobbyButton.style.visibility = 'hidden';
};

//used when this client is an artist
const artistPlacemat =  () => {
    //re-add drawing elements if new round and artist
    canvas.style.display = "inline";
    inkwell.style.display = "block";
    isVoter = false;
    document.getElementById("instructions").innerHTML = 
        "You are a drawer.<br>Remember to use your ink carefully, you don't have much!";
    //remove voter elements
    guessTextBox.style.display = "none";
    guessTextBox.disabled = true;
    enterGuessButton.style.display = "none";
    firstCanvas.style.display = "none";
    secondCanvas.style.display = "none";
};

//used when this client is a voter
const voterPlacemat = () => {
    document.getElementById("instructions").innerHTML = 
        "You are a voter.<br>Try to guess what the drawers are inking up!<br>You get two seperate drawings to look at!";
    //remove drawing elements
    canvas.style.display = "none";
    inkwell.style.display = "none";
    isVoter = true;
    setCanvases();
    //re-add voter elements if new round and different role
    guessTextBox.style.display = "inline-block";
    guessTextBox.disabled = false;
    enterGuessButton.style.display = "inline-block";
    enterGuessButton.style.visibility = "visible";
    firstCanvas.style.display = "inline";
    secondCanvas.style.display = "inline";
};

//used when this client enter a lobby
const lobbyPlacemat = () => {
    document.getElementById("gameCover").style.display = "block";
    document.getElementById("roomSelectScreen").style.display = "none";
    document.getElementById("titleText").style.display = "none";
    document.getElementById("titleSubtext").style.display = "none";
    roomTextBox.disabled = true;
    roomTextBox.style.display = "none";
    userTextBox.disabled = true;
    userTextBox.style.display = "none";
    enterRoomButton.style.display = 'none';
    initiateLobbyButton.style.visibility = 'visible';
    document.getElementById("loadingMessage").style.display = "inline";
    document.getElementById("instructions").style.display = "none";
};

//populate leaderboard with scores
const populateLeaderboard = () => {
  const data = { 
    userID: user,
    roomID: room,
    scoreID: score };
  socket.emit('leaderboardData', data);
};

//this method takes the gathered player points and sorts them, then displays them on the leaderboard
const displayLeaderboard = (data) => {
    console.log(data);
    document.getElementById("gameCover").style.display = "block";  
    document.getElementById("fakeVertisment").style.display = "block";
    document.getElementById("leaderboard").style.display = "block";
    document.getElementById("leaderboard").innerHTML = "<p>____Leaderboard____</p>";
    leaderboardTracker = data.leaderboardScores;
    leaderboardTracker.sort(leaderboardSort);
    for(let i = 0; i < leaderboardTracker.length; i++){
        const username = leaderboardTracker[i].userID;
        const endScore = leaderboardTracker[i].scoreID;


        var p = document.createElement("p");
        var node = document.createTextNode(username + ": " + endScore + " points");
        p.appendChild(node);

        document.getElementById("leaderboard").appendChild(p);
    }

    initiateNewRoundButton.style.visibility = 'visible';
};

//sort
const leaderboardSort = (a, b) => {
    return b.scoreID - a.scoreID;            
}

const rejectedFromGame = () => {
     //reverse all UI changes, join failed
        roomTextBox.disabled = false;
        roomTextBox.style.display = "inline-block";
        userTextBox.disabled = false;
        userTextBox.style.display = "inline-block";
        document.getElementById("room").value = null;
        room = null;
        enterRoomButton.style.display = 'inline';
        initiateLobbyButton.style.visibility = 'hidden';
        document.getElementById("gameCover").style.display = "none";
        document.getElementById("loadingMessage").style.display = "none";
        document.getElementById("instructions").style.display = "none";
        canvas.style.display = "none";
        inkwell.style.display = "none";
        guessTextBox.style.display = "none";
        guessTextBox.disabled = true;
        enterGuessButton.style.display = "none";
        firstCanvas.style.display = "none";
        secondCanvas.style.display = "none";
        document.getElementById("roomSelectScreen").style.display = "block";
        document.getElementById("titleText").style.display = "inline";
        document.getElementById("titleSubtext").style.display = "inline";
        document.getElementById("room").placeholder = "That lobby is taken!";
}

//Inspired by the canvas syncing assignments
const handleMessage = (data) => {

    let image = new Image();
    image.src = data.imgData;

    image.onload = () => {
        console.log("firstCheck: " + data.isFirst + "secondCheck: " + data.isSecond);
        //displays the drawers drawings on only one canvas
        if(data.isFirst == true){
            firstCtx.save();
            firstCtx.globalCompositeOperation = "source-over"; //this is default for canvas-->
            firstCtx.drawImage(image, data.x, data.y, data.width, data.height);    
            firstCtx.restore();
        }
        else{ 
            if(data.isSecond == true){
                secondCtx.save();
                secondCtx.globalCompositeOperation = "source-over"; //this is default for canvas-->
                secondCtx.drawImage(image, data.x, data.y, data.width, data.height);    
                secondCtx.restore();
            }
        }
    };
}

//similar architecture
const init = () => {
    socket = io.connect();
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    firstCanvas = document.getElementById("firstCanvas");
    firstCtx = firstCanvas.getContext("2d");
    secondCanvas = document.getElementById("secondCanvas");
    secondCtx = secondCanvas.getContext("2d");
    inkwell = document.getElementById("inkwell");
    enterRoomButton = document.getElementById("roomEnter");
    initiateLobbyButton = document.getElementById("initiateLobby");
    initiateNewRoundButton = document.getElementById("initiateNewRound");
    enterGuessButton = document.getElementById("guessButton");
    chatBox = document.getElementById("chatBox");
    userTextBox = document.getElementById("username");
    //Press enter for easy access
    roomTextBox = document.getElementById("room");
    roomTextBox.addEventListener("keyup", function(e) {
      event.preventDefault();
      if(event.keyCode == 13) {
          enterRoomButton.click();
      }
    });
  enterRoomButton.onclick = enterRoom;
  initiateLobbyButton.onclick = initiateLobby;
  initiateNewRoundButton.onclick = initiateNewRound;
  enterGuessButton.onclick = submitAnswer;          
    //Press enter for easy access
  guessTextBox = document.getElementById("guessText");
  guessTextBox.addEventListener("keyup", function(e) {
      event.preventDefault();
      if(event.keyCode == 13) {
          enterGuessButton.click();
      }
  });
  //event listeners
  canvas.onmousedown = doMousedown;
  canvas.onmousemove = doMousemove;
  canvas.onmouseup = doMouseup;
  canvas.onmouseout = doMouseout;
  socketOn();
};

const useInk = () => {
//increment ink usage while player is dragging with mouse down
currentInk--;
if(currentInk <= 0) outOfInk = true;

let ink = document.getElementById("emptyInk");
//change the inkwell's content
let width = currentInk / 2;
ink.style.width = width + '%';
};

const doMousedown = (mouseData) => {
dragging = true;

//get location off mouse in cannvas coordinates
var mouse = getMouse(mouseData);
 ctx.beginPath();
 ctx.moveTo(mouse.x, mouse.y);
};

const doMousemove = (mouseData) => {
//bail out if the mouse button is not down
if (!dragging) return;

//get location of mouse in canvas coordinates
var mouse = getMouse(mouseData);

  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";
  ctx.lineWidth = 5;

  //draw a line to x,y of mouse
  ctx.lineTo(mouse.x, mouse.y);

if(outOfInk == false){
  //stroke the line
  ctx.stroke();
}

  //use Ink
useInk();
};

const doMouseup = () => {
ctx.closePath();
dragging = false;
    const data = {
        x: 0,
        y: 0,
        height: 600,
        width: 900, 
        imgData: canvas.toDataURL(),
        userID: user,
        roomID: room
    };
socket.emit("sendCanvas", data);
};

const doMouseout = () => {
ctx.closePath();
dragging = false;
const data = {
        x: 0,
        y: 0,
        height: 600,
        width: 900, 
        imgData: canvas.toDataURL(),
        userID: user,
        roomID: room
    };
socket.emit("sendCanvas", data);
};

//This method originally written by Tony Jefferson (IGM)
const getMouse = (mouseData) => {
var mouse = {}
mouse.x = mouseData.pageX - mouseData.target.offsetLeft;
mouse.y = mouseData.pageY - mouseData.target.offsetTop;
return mouse;
};

window.onload = init;