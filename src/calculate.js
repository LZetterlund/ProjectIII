module.exports = {

  // This method originally written by Luke Zetterlund (2017)
  processGuess(data, room) {
    const currentRoom = room;
    // calculate whether it was first or second's points
    let drawer;
    if (currentRoom.rpcCalls % 2 === 1) {
      drawer = currentRoom.firstID;
    } else {
      drawer = currentRoom.secondID;
    }
    const lesserCaseGuess = data.guessID.toString().toLowerCase();
    const guessData = {
      isGuessCorrect: lesserCaseGuess === currentRoom.answer,
      userID: data.userID,
      drawerID: drawer,
      wrongAnswer: lesserCaseGuess,
    };
    return guessData;
  },

  // Gathers sccores and sends it back out to all users
  getLeaderboard(data, room) {
    const currentRoom = room;
    // if(currentRoom.allScores)
    // add all users scores to this array
    const newScore = {
      userID: data.userID,
      scoreID: data.scoreID,
    };
    currentRoom.allScores.push(newScore);

    const playerPoints = {
      numPlayers: currentRoom.usernames.length,
      leaderboardScores: currentRoom.allScores,
    };
    return playerPoints;
  },
};
