

const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3023;

// read the client html file into memory
// __dirname in node is the current directory
// (in this case the same folder as the server js file)
const index = fs.readFileSync(`${__dirname}/../client/index.html`);

const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1: ${port}`);

// pass in the http server into socketio and grab the webscoket server as io
const io = socketio(app);

// keep track of all different rooms
const rooms = [];

// triggers when user joins a room
const join = (data) => {
// grab the room using the player entered room ID
  const roomEntered = rooms.filter(obj => obj.ID === data.roomID);
  // NEW check if first user, add one user either way
  if (roomEntered[0].users !== undefined) {
    // check to see if lobby is already full or if the game is already started
    if (roomEntered[0].users >= 8 || roomEntered[0].gameStarted === true) {
      // tell client that the join failed
      io.sockets.in(data.roomID).emit('failedToJoin');
    } else {
      roomEntered[0].users++;
    }
  } else { roomEntered[0].users = 1; }
  // ifthere are 8 or less users, check for players, else skip it
  // check to see whether the user can be either first or second player
  if (roomEntered[0].users <= 8) {
    if (roomEntered[0].player1ID == null) {
      console.log('Player 1 added');
      roomEntered[0].player1ID = data.userID;
    } else if (roomEntered[0].player2ID == null) {
      console.log('Player 2 added');
      roomEntered[0].player2ID = data.userID;
    }
  }
};

const endTheRound = (data) => {
  // implement other end of round code here
  io.sockets.in(data.roomID).emit('endTheRound');
};

// this is used to send drawing data to other users
const update = (data) => {
// grab the room using the player entered room ID
  const roomEntered = rooms.filter(obj => obj.ID === data.roomID);
  if (roomEntered[0] != null) {
    const { x } = data;
    const { y } = data;
    const { height } = data;
    const { width } = data;
    const { imgData } = data;
    // for which canvas the data should go to
    const isPlayer1 = data.userID === roomEntered[0].player1ID;
    const isPlayer2 = data.userID === roomEntered[0].player2ID;
    // for debug purposes
    const currentUser = data.userID;
    const player1 = roomEntered[0].player1ID;
    const player2 = roomEntered[0].player2ID;

    io.sockets.in(data.roomID).emit('draw', {
      x, y, height, width, imgData, isPlayer1, isPlayer2, currentUser, player1, player2,
    });
  }
};

const startRoundLoop = (data) => {
  const roomEntered = rooms.filter(obj => obj.ID === data.roomID);
  if (roomEntered[0] != null) {
    console.log(roomEntered[0].rotateCount);
    // Go through initial drawing period, if its been gone through, continue
    if (roomEntered[0].initialDrawing !== undefined) {
      setTimeout(startRoundLoop, 5000, data);
      roomEntered[0].initialDrawing = true;
      io.sockets.in(data.roomID).emit('changeHighlighted');
    } else {
      // After initial drawing begin flipping the highlighted drawings
      if (roomEntered[0].rotateCount !== undefined) {
        roomEntered[0].rotateCount++;
      } else {
        roomEntered[0].rotateCount = 0;
      }

      // tell clients to rotate highlighted drawing and give answer data to drawers
      const answerData = { answerID: roomEntered[0].answer };
      io.sockets.in(data.roomID).emit('changeHighlighted', answerData);

      // if the drawings have rotated 5 times then end the round
      // start the set interval to switch drawings once the initial drawing period is up
      if (roomEntered[0].rotateCount <= 5) {
        setTimeout(startRoundLoop, 5000, data);
      } else {
        endTheRound(data);
      }
    }
  }
};

const startGame = (data) => {
  // grab the room using the player entered room ID
  const roomEntered = rooms.filter(obj => obj.ID === data.roomID);
  if (roomEntered[0] != null) {
    // TODO: FIX TO 3 BEFORE TURN IN, TEMP AT 1
    if (roomEntered[0].users >= 3) {
      const playerData =
        {
          player1: roomEntered[0].player1ID,
          player2: roomEntered[0].player2ID,
        };
      io.sockets.in(data.roomID).emit('UI', playerData);
      roomEntered[0].gameStarted = true;

      // TODO: HERE ADD THE TIMER CODE TO START THE ROUND / SWITCH BETWEEN ROUNDS
      // TODO: REMEMBER TO EMIT A METHOD TO THE ROOM ON A "SETINTERVAL" METHOD
      // TO CHANGE THE UI USING THE "changeHighlighted" method.
      io.sockets.in(data.roomID).emit('startCountdown');

      setTimeout(startRoundLoop, 7500, data);
      // TODO: This is where the answer would change if I ever added that in.
      roomEntered[0].answer = 'tree';
    } else {
      console.log('Failed to start game: not enough players');
      io.sockets.in(data.roomID).emit('failedToStart', data);
    }
  }
};

// used to pass data through and properly disconnect the drawers from the game
const discPlayers = (data) => {
// grab the room using the player entered room ID
  const roomEntered = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (roomEntered[0] != null) {
    console.log(`CurrentUser: ${data.userID} Player1: ${roomEntered[0].player1ID} Player2: ${roomEntered[0].player2ID}`);
    if (data.userID === roomEntered[0].player1ID) {
      roomEntered[0].player1ID = null;
      console.log(`disconnecting player 1 from room: ${roomEntered[0].ID}`);
    }

    if (data.userID === roomEntered[0].player2ID) {
      roomEntered[0].player2ID = null;
      console.log(`disconnecting player 2 from room: ${roomEntered[0].ID}`);
    }
  }
};

const processGuess = (data) => {
  const roomEntered = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (roomEntered[0] != null) {
    // calculate whether it was player1 or player2's points
    let drawer;
    if (roomEntered[0].rotateCount % 2 === 1) {
      drawer = roomEntered[0].player1ID;
    } else {
      drawer = roomEntered[0].player2ID;
    }
    const lesserCaseGuess = data.guessID.toString().toLowerCase();
    const guessData = {
      guessAnswer: lesserCaseGuess === roomEntered[0].answer,
      userID: data.userID,
      drawerID: drawer,
    };
    io.sockets.in(data.roomID).emit('guessOutcome', guessData);
  }
};

const processScores = (data) => {
  const roomEntered = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (roomEntered[0] != null) {
    if (roomEntered[0].topScore === undefined) {
      roomEntered[0].topScorer = data.userID;
      roomEntered[0].topScore = data.scoreID;
      console.log(`${data.userID} is new top score ${data.scoreID}`);
    } else if (roomEntered[0].topScore < data.scoreID) {
      roomEntered[0].topScorer = data.userID;
      roomEntered[0].topScore = data.scoreID;
      console.log(`${data.userID} is new top score ${data.scoreID}`);
    }

    const scoreData = {
      winnerID: roomEntered[0].topScorer,
      topScoreID: roomEntered[0].topScore,
    };

    io.sockets.in(data.roomID).emit('endLobby', scoreData);
  }
};

io.sockets.on('connection', (socket) => {
  console.log('started');

  //  onJoined(socket);
  // io.sockets.manager.room to check active rooms
  socket.on('join', (data) => {
    const room = data.roomID;
    socket.room = room; // eslint-disable-line no-param-reassign
    socket.user = data.userID; // eslint-disable-line no-param-reassign
    // grab the room using the player entered room ID
    const result = rooms.filter(obj => obj.ID === room);
    // checks if room exists as to not error out
    if (result[0] !== undefined) {
      socket.join(result[0].ID);
      console.log(`Joined room ${result[0].ID}`);
    } else { // else just create the room and sets its ID to grab it from the array with no issues
      rooms[rooms.length] = { ID: room };
      socket.join(room);
      console.log(`Joined room ${room}`);
    }
    join(data);
  });
  socket.on('update', (data) => {
    update(data);
  });
  // my disconnect function that removes players from the proper rooms
  socket.on('discPlayers', (data) => {
    discPlayers(data);
  });
  socket.on('disconnect', () => {
  // grab the room using the player entered room ID
    const roomEntered = rooms.filter(obj => obj.ID === socket.room);
    // check if in a room here because this disconnect is only called once, the other possibly more
    // decriment users
    if (roomEntered[0] != null) {
      roomEntered[0].users--;
      const data = { roomID: socket.room, userID: socket.user };
      discPlayers(data);
    }
  });
  socket.on('startGame', (data) => {
    startGame(data);
  });
  socket.on('enterGuess', (data) => {
    processGuess(data);
  });
  socket.on('sendScore', (data) => {
    processScores(data);
  });
  // useInk server side later
});

console.log('Websocket server started');

// A few things to be cleaned up: transitions, timer, hashing to grab users
