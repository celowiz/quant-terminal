import logging
from pathlib import Path
from datetime import datetime


def setup_daily_rotating_logger(logger_name: str, log_dir: str) -> logging.Logger:
    logger = logging.getLogger(logger_name)
    if logger.handlers:
        return logger
    path = Path(log_dir)
    path.mkdir(parents=True, exist_ok=True)
    # Nome do arquivo = data do dia atual
    filename = path / f"{datetime.now().strftime('%d-%m-%Y')}.log"
    file_handler = logging.FileHandler(filename, encoding='utf-8')
    formatter = logging.Formatter(
        fmt='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    # Console handler para ver no stdout do Uvicorn também
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)
    logger.setLevel(logging.DEBUG)
    return logger


