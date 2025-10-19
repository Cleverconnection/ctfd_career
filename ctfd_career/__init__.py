from flask import Blueprint

from . import models, routes


def load(app):
    """Register the CTFd Career plugin blueprint and assets."""
    blueprint = Blueprint(
        "career",
        __name__,
        template_folder="templates",
        static_folder="static",
    )

    routes.register_routes(blueprint)
    app.register_blueprint(blueprint, url_prefix="/plugins/career")

    from CTFd.plugins import register_plugin_assets_directory

    register_plugin_assets_directory(app, base_path="/plugins/ctfd_career/static/")

    try:  # pragma: no cover - fallback for legacy installations without migrations helper
        from CTFd.plugins.migrations import upgrade

        upgrade(plugin_name="ctfd_career")
    except Exception:
        pass

    print("<<<<< CTFd Career Plugin loaded successfully >>>>>", flush=True)
