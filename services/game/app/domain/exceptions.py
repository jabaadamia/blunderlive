class GameException(Exception):
    """Base game domain exception."""


class GameNotFoundError(GameException):
    """Raised when a game with the specified ID does not exist."""


class GameAlreadyFinishedError(GameException):
    """Raised when trying to make a move on a finished game."""


class NotPlayersTurnError(GameException):
    """Raised when a player tries to make a move when it's not their turn."""


class IllegalMoveError(GameException):
    """Raised when a move is not legal according to chess rules."""


class PlayerNotInGameError(GameException):
    """Raised when a player is not in the specified game."""

class ConcurrentMoveConflictError(GameException):
    """Raised when game state changed concurrently."""

class InvalidDrawStateError(GameException):
    """Raised when a draw offer is in an invalid state for the attempted action."""