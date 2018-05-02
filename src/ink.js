const calculate = require('./calculate.js');

// hold every room in an array
const rooms = [];

// when player joins game
const onJoined = (data, sentIO) => {
  // send the io
  const io = sentIO;
  // get current room from array of all rooms
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  const currentRoom = currentRoomArray[0];

  if (currentRoom.lobbyInitiated === true) {
    console.log(`${data.userID} should not be in this lobby`);
    io.sockets.in(data.roomID).emit('lobbyHasStarted');
    return;
  }
  // if username array doesn't exist, create it
  if (currentRoom.usernames === undefined) {
    currentRoom.usernames = [];
  }
  // stop joining the session at 8 players in lobby, or if game started
  if (currentRoom.lobbyInitiated === true || currentRoom.usernames.length >= 8) {
    io.sockets.in(data.roomID).emit('lobbyTaken');
  } else {
    // object holding every username, create if doesn't exist
    currentRoom.usernames[currentRoom.usernames.length] = { ID: data.userID };
  }
};

// used to reset for new games
const initiateNewRound = (data, sentIO) => {
  // send the io
  const io = sentIO;
  // things to reset with a new game here
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  if (currentRoomArray[0] != null) {
    // const currentRoom = currentRoomArray[0];
  }
  // send message to others
  io.sockets.in(data.roomID).emit('newRound', data);
};

// notifies players to populate the leaderboard with their scores
const populateLeaderboard = (data, sentIO) => {
  // send the io
  const io = sentIO;
  io.sockets.in(data.roomID).emit('populateLeaderboard');
};

// This method originally written by Luke Zetterlund (2017)
const startRoundLoop = (data, sentIO) => {
  // send the io
  const io = sentIO;
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    // Check this initally as to not error out
    if (currentRoom.initialDrawing !== undefined) {
      setTimeout(startRoundLoop, 8000, data, io);
      currentRoom.initialDrawing = true;
      io.sockets.in(data.roomID).emit('nextDrawing');
    } else {
      if (currentRoom.rpcCalls !== undefined) {
        currentRoom.rpcCalls++;
      } else {
        currentRoom.rpcCalls = 0;
      }

      // transfer answer and translate canvases
      const answerData = { answerID: currentRoom.answer };
      io.sockets.in(data.roomID).emit('nextDrawing', answerData);

      // if the drawings have rotated 5 times then end the round
      // start the set interval to switch drawings once the initial drawing period is up
      if (currentRoom.rpcCalls <= 5) {
        setTimeout(startRoundLoop, 8000, data, io);
      } else {
        populateLeaderboard(data, sentIO);
      }
    }
  }
};

// checks whether or not a given lobby is free to join, or not
const isLobbyOpen = (data, sentIO) => {
  // send the io
  const io = sentIO;
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    if (currentRoom.lobbyInitiated === true) {
      io.sockets.in(data.roomID).emit('lobbyHasStarted', data);
    } else {
      io.sockets.in(data.roomID).emit('lobbyReply', data);
    }
  } else { // if the current room is null, send them the ok
    io.sockets.in(data.roomID).emit('lobbyReply', data);
  }
};

// Once players are in lobby, and are ready to go launch into a game
const initiateLobby = (data, sentIO) => {
  // send the io
  const io = sentIO;
  // get current room from array of all rooms
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    console.log(`player verified?${data.verifiedPlayer}`);
    if (currentRoom.lobbyInitiated === true && data.verifiedPlayer !== true) {
      console.log(`${data.userID} should not be in this lobby ${data.roomID}`);
      io.sockets.in(data.roomID).emit('lobbyHasStarted');
      return;
    }
    // restart rpcCalls for new rounds at the end of games
    currentRoom.rpcCalls = 0;
    currentRoom.allScores = [];
    // check to make sure no duplicate games get started
    if (currentRoom.usernames.length >= 3) {
      currentRoom.lobbyInitiated = true;

      // all possible answers are randomly selected at the start of every round
      const answers = ['graduation', 'happy', 'computer', 'magnet', 'robot', 'ink',
        'star', 'wifi', 'lollipop', 'flower', 'angry', 'toothbrush',
        'egg', 'beard', 'shoelace', 'peanut', 'sun', 'basketball',
        'snake', 'glasses', 'confused', 'camera', 'smell', 'key',
        'blackhole', 'dumbbell', 'clown', 'cat', 'brain',
        'dog', 'beer', 'wave', 'cube'];
      currentRoom.answer = answers[Math.floor(Math.random() * answers.length)];

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

      // ensures the artists are notifed of their duties
      const playerData = {
        first: currentRoom.firstID,
        second: currentRoom.secondID,
      };
      io.sockets.in(data.roomID).emit('setPlayers', playerData);

      // Triggers "loadingScreen" method and begins the game
      io.sockets.in(data.roomID).emit('loadingScreen');

      // this is the timer before the game starts in the loading lobby
      setTimeout(startRoundLoop, 6000, data, io);
    } else {
      const membersInLobby = currentRoom.usernames.length;
      io.sockets.in(data.roomID).emit('notEnoughPlayers', membersInLobby);
    }
  }
};

// This method is inspired by the canvas-syncing-assignments
// emits the current canvas of one of the artists to all players
const sendCanvas = (data, sentIO) => {
  // send the io
  const io = sentIO;
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

    io.sockets.in(data.roomID).emit('drawCanvas', {
      x, y, height, width, imgData, isFirst, isSecond, currentUser, first, second,
    });
  }
};

// turns drawers null and sends disconnect data to all players
const sendLeaveData = (data) => {
  // get current room from array of all rooms
  const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
  // check if room exists as to not error out
  if (currentRoomArray[0] != null) {
    const currentRoom = currentRoomArray[0];
    if (data.userID === currentRoom.firstID) {
      currentRoom.firstID = null;
    }

    if (data.userID === currentRoom.secondID) {
      currentRoom.secondID = null;
    }
  }
};

// set up the sockets
const connectSocketServer = (io) => {
  io.on('connection', (sock) => {
    const sentIO = io;
    const socket = sock;

    socket.on('join', (data) => {
      const room = data.roomID;
      const user = data.userID;
      socket.room = room;
      socket.user = user;
      // get current room from array of all rooms
      const currentRoomArray = rooms.filter(obj => obj.ID === room);
      const currentRoom = currentRoomArray[0];
      // checks if room exists as to not error out
      if (currentRoom !== undefined) {
      // don't join if game is in session
        if (currentRoom.lobbyInitiated === true) {
          console.log(`${data.userID}should not be in this lobby`);
          io.sockets.in(data.roomID).emit('lobbyHasStarted');
        }
        socket.join(currentRoom.ID);
        console.log(`${user} joined room ${currentRoom.ID}`);
      } else { // else create room and username holder
        rooms[rooms.length] = { ID: room };
        socket.join(room);
        console.log(`${user} joined room ${currentRoom.ID}`);
      }
      onJoined(data, sentIO);
    });
    socket.on('sendCanvas', (data) => {
      sendCanvas(data, sentIO);
    });
    // my disconnect function that removes players from the proper rooms
    socket.on('sendLeaveData', (data) => {
      sendLeaveData(data);
    });
    socket.on('disconnect', () => {
      // get current room from array of all rooms
      const currentRoomArray = rooms.filter(obj => obj.ID === socket.room);
      // decriment numUsers
      if (currentRoomArray[0] != null) {
      // purge user from array
        currentRoomArray[0].usernames.filter(obj => obj.ID === socket.user).pop();
        const data = { roomID: socket.room, userID: socket.user };
        sendLeaveData(data, sentIO);
      }
    });

    socket.on('initiateNewRound', (data) => {
      initiateNewRound(data, sentIO);
    });
    socket.on('initiateLobby', (data) => {
      initiateLobby(data, sentIO);
    });
    socket.on('submitAnswer', (data) => {
      const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
      if (currentRoomArray[0] != null) {
        const currentRoom = currentRoomArray[0];
        const guessData = calculate.processGuess(data, currentRoom);
        io.sockets.in(data.roomID).emit('updateChatroom', guessData);
      }
    });
    socket.on('leaderboardData', (data) => {
      const currentRoomArray = rooms.filter(obj => obj.ID === data.roomID);
      if (currentRoomArray[0] != null) {
        const currentRoom = currentRoomArray[0];
        const playerPoints = calculate.getLeaderboard(data, currentRoom);
        io.sockets.in(data.roomID).emit('displayLeaderboard', playerPoints);
      }
    });
    socket.on('isLobbyOpen', (data) => {
      isLobbyOpen(data, sentIO);
    });
  });
};

module.exports.connectSocketServer = connectSocketServer;
