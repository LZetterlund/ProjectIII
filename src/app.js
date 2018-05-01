const http = require('http');
const socketio = require('socket.io');
// MVC server to host our files
const express = require('express');
const path = require('path');
// const fs = require('fs');

const port = process.env.PORT || process.env.NODE_PORT || 3092;

const app = express();

app.use('/assets', express.static(path.resolve(`${__dirname}/../hosted/`)));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(`${__dirname}/../hosted/index.html`));
});

// start http server and get HTTP server instance
const server = http.createServer(app);

// pass in the http server into socketio and grab the webscoket server as io
const io = socketio(server);

server.listen(port, (err) => {
  if (err) {
    throw err;
  }
  console.log(`Listening on port ${port}`);
});

// hold every room in an array
const rooms = [];

// when player joins game
const onJoined = (data) => {
  // get current room from array of all rooms
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  const currentRoom = currentRoomArray[0];
  // if username array doesn't exist, create it
  if (currentRoom.usernames === undefined) {
    currentRoom.usernames = [];
  }
  // stop joining the session at 8 players in lobby, or if game started
  if (currentRoom.usernames.length >= 8 || currentRoom.gameStarted === true) {
    io.sockets.in(data.roomID).emit('failedToJoin');
  } else {
    // object holding every username, create if doesn't exist
    currentRoom.usernames[currentRoom.usernames.length] = { ID: data.userID };
  }
};

const endTheRound = (data) => {
  // leaderboard?
  io.sockets.in(data.roomID).emit('endTheRound');
};

// this is used to send drawing data to other players
const update = (data) => {
// get current room from array of all rooms
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    // For the leaderboard
    const currentUser = data.userID;
    const first = currentRoom.firstID;
    const second = currentRoom.secondID;
    // canvas data
    const { x } = data;
    const { y } = data;
    const { height } = data;
    const { width } = data;
    const { imgData } = data;
    // Seperate drawer's canvas'
    const isFirst = data.userID === currentRoom.firstID;
    const isSecond = data.userID === currentRoom.secondID;

    io.sockets.in(data.roomID).emit('draw', {
      x, y, height, width, imgData, isFirst, isSecond, currentUser, first, second,
    });
  }
};

// used to reset for new games
const startNewGame = (data) => {
  // things to reset with a new game here
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  if (currentRoomArray[0] != null) {
    // const currentRoom = currentRoomArray[0];
  }
  // send message to others
  io.sockets.in(data.roomID).emit('newGame', data);
};

// This method originally written by Luke Zetterlund (IGM)
const startRoundLoop = (data) => {
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    console.log(currentRoom.rotateCount + data.userID);
    // Go through initial drawing period, if its been gone through, continue
    if (currentRoom.initialDrawing !== undefined) {
      setTimeout(startRoundLoop, 8000, data);
      currentRoom.initialDrawing = true;
      io.sockets.in(data.roomID).emit('nextDrawing');
    } else {
      // After initial drawing begin flipping the highlighted drawings
      if (currentRoom.rotateCount !== undefined) {
        currentRoom.rotateCount++;
      } else {
        currentRoom.rotateCount = 0;
      }

      // tell clients to rotate highlighted drawing and give answer data to drawers
      const answerData = { answerID: currentRoom.answer };
      io.sockets.in(data.roomID).emit('nextDrawing', answerData);

      // if the drawings have rotated 5 times then end the round
      // start the set interval to switch drawings once the initial drawing period is up
      if (currentRoom.rotateCount <= 5) {
        setTimeout(startRoundLoop, 8000, data);
      } else {
        endTheRound(data);
      }
    }
  }
};

const startGame = (data) => {
  // get current room from array of all rooms
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    // restart rotatecount for new rounds at the end of games
    currentRoom.rotateCount = 0;
    // check to make sure no duplicate games get started
    if (currentRoom.usernames.length >= 3) {
      currentRoom.gameStarted = true;
      // Select first and second randomly using a random username in the usernames array
      currentRoom.firstID =
          currentRoom.usernames[Math.floor((Math.random() * currentRoom.usernames.length))].ID;
      console.log(`First:${currentRoom.firstID}`);
      currentRoom.secondID =
          currentRoom.usernames[Math.floor((Math.random() * currentRoom.usernames.length))].ID;
      // while first equals second keep re-rolling until they are not the same
      while (currentRoom.firstID === currentRoom.secondID) {
        currentRoom.secondID =
            currentRoom.usernames[Math.floor((Math.random() * currentRoom.usernames.length))].ID;
      }
      console.log(`Second:${currentRoom.secondID}`);

      const playerData =
        {
          first: currentRoom.firstID,
          second: currentRoom.secondID,
        };
      io.sockets.in(data.roomID).emit('UI', playerData);

      // Triggers "startCountdown" method and begins the game
      io.sockets.in(data.roomID).emit('startCountdown');

      setTimeout(startRoundLoop, 6000, data);
      // TODO: Change answer
      currentRoom.answer = 'star';
    } else {
      console.log('Failed to start game: not enough players OR the game was started');
      io.sockets.in(data.roomID).emit('failedToStart', data);
    }
  }
};

// TODO: possibly remove users from username list when disconnected
// used to pass data through and properly disconnect the drawers from the game
const discPlayers = (data) => {
// get current room from array of all rooms
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    console.log(`CurrentUser: ${data.userID} First: ${currentRoom.firstID} Second: ${currentRoom.secondID}`);
    if (data.userID === currentRoom.firstID) {
      currentRoom.firstID = null;
      console.log(`disconnecting first from room: ${currentRoom.ID}`);
    }

    if (data.userID === currentRoom.secondID) {
      currentRoom.secondID = null;
      console.log(`disconnecting second from room: ${currentRoom.ID}`);
    }
  }
};

// TODO: rewrite this method to include missed letters for answer OR chatroom
// This method originally written by Luke Zetterlund
const processGuess = (data) => {
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    // calculate whether it was first or second's points
    let drawer;
    if (currentRoom.rotateCount % 2 === 1) {
      drawer = currentRoom.firstID;
    } else {
      drawer = currentRoom.secondID;
    }
    const lesserCaseGuess = data.guessID.toString().toLowerCase();
    const guessData = {
      guessAnswer: lesserCaseGuess === currentRoom.answer,
      userID: data.userID,
      drawerID: drawer,
    };
    io.sockets.in(data.roomID).emit('guessOutcome', guessData);
  }
};

// TODO: redo this method a the leaderboard
// This method originally written by Luke Zetterlund
const getLeaderboard = (data) => {
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    if (currentRoom.topScore === undefined) {
      currentRoom.topScorer = data.userID;
      currentRoom.topScore = data.scoreID;
      console.log(`${data.userID} is new top score ${data.scoreID}`);
    } else if (currentRoom.topScore < data.scoreID) {
      currentRoom.topScorer = data.userID;
      currentRoom.topScore = data.scoreID;
      console.log(`${data.userID} is new top score ${data.scoreID}`);
    }

    const scoreData = {
      winnerID: currentRoom.topScorer,
      topScoreID: currentRoom.topScore,
    };

    io.sockets.in(data.roomID).emit('endLobby', scoreData);
  }
};

io.sockets.on('connection', (socket) => {
  console.log('started');

  socket.on('join', (data) => {
    const room = data.roomID;
    const user = data.userID;
    socket.room = room; // eslint-disable-line no-param-reassign
    socket.user = data.userID;// eslint-disable-line no-param-reassign
    // get current room from array of all rooms
    const currentRoomArray = rooms.filter(obj => obj.ID === room);
    const currentRoom = currentRoomArray[0];
    // checks if room exists as to not error out
    if (currentRoom !== undefined) {
      // don't join if game is in session
      if (currentRoom.gameStarted === true) {
        socket.to(socket.id).emit('failedToJoin');
        return;
      }
      socket.join(currentRoom.ID);
      console.log(`Joined room ${currentRoom.ID}`);
    } else { // else create room and username holder
      rooms[rooms.length] = { ID: room };
      // rooms[rooms.length].usernames = [];
      socket.join(room);
      console.log(`${user} joined room ${room}`);
    }
    onJoined(data);
  });
  socket.on('update', (data) => {
    update(data);
  });
  // my disconnect function that removes players from the proper rooms
  socket.on('discPlayers', (data) => {
    discPlayers(data);
  });
  socket.on('disconnect', () => {
  // get current room from array of all rooms
    const currentRoomArray = rooms.filter(obj => obj.ID === socket.room);
    // check if in a room here because this disconnect is only called once, the other possibly more
    // decriment numUsers
    if (currentRoomArray[0] != null) {
      // purge user from array
      currentRoomArray[0].usernames.filter(obj => obj.ID === socket.user).pop();
      const data = { roomID: socket.room, userID: socket.user };
      discPlayers(data);
    }
  });

  socket.on('startNewGame', (data) => {
    startNewGame(data);
  });
  socket.on('startGame', (data) => {
    startGame(data);
  });
  socket.on('enterGuess', (data) => {
    processGuess(data);
  });
  socket.on('sendScore', (data) => {
    getLeaderboard(data);
  });
});

console.log('Websocket server started');
