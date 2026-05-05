from enum import StrEnum


class GameStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    FINISHED = "finished"
    ABANDONED = "abandoned"


class GameResult(StrEnum):
    WHITE_WIN = "1-0"
    BLACK_WIN = "0-1"
    DRAW = "1/2-1/2"


class TerminationType(StrEnum):
    CHECKMATE = "checkmate"
    STALEMATE = "stalemate"
    DRAW_AGREEMENT = "draw_agreement"
    INSUFFICIENT_MATERIAL = "insufficient_material"
    RESIGNATION = "resignation"
    ABANDONED = "abandoned"


class PlayerColor(StrEnum):
    WHITE = "white"
    BLACK = "black"
