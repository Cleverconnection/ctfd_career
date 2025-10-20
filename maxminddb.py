class _DummyDatabase:
    def __init__(self, *args, **kwargs):
        pass

    def get(self, _):
        return {}

    def close(self):
        pass


def open_database(_path):
    return _DummyDatabase()
