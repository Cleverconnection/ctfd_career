from flask import Blueprint
from CTFd.models import db
from CTFd.plugins import register_plugin_assets_directory

try:  # pragma: no cover - compatibility shim
    from CTFd.plugins import register_admin_menu_bar
except ImportError:  # pragma: no cover - compatibility shim
    register_admin_menu_bar = None
    try:
        from CTFd.plugins import register_admin_plugin_menu_bar as register_admin_menu_bar
    except ImportError:  # pragma: no cover - compatibility shim
        try:
            from CTFd.plugins import register_admin_page_menu_bar as register_admin_menu_bar
        except ImportError:  # pragma: no cover - compatibility shim
            register_admin_menu_bar = None

from . import models, routes


def load(app):
    """Register the CTFd Career plugin blueprint and assets."""
    print("<<<<< CTFd Career Plugin: inicializando >>>>>", flush=True)

    # 🔧 Cria as tabelas do plugin automaticamente, caso não existam
    with app.app_context():
        try:
            db.create_all()
            print("<<<<< CTFd Career Plugin: tabelas sincronizadas >>>>>", flush=True)
        except Exception as e:
            print(f"⚠️  Erro ao criar tabelas do Career Plugin: {e}", flush=True)

    # Blueprint e rotas
    blueprint = Blueprint(
        "career",
        __name__,
        template_folder="templates",
        static_folder="static",
    )

    routes.register_routes(blueprint)
    app.register_blueprint(blueprint, url_prefix="/plugins/career")

    # Registro do menu administrativo e assets estáticos
    if register_admin_menu_bar:
        register_admin_menu_bar("Carreiras", "/plugins/career/admin")
    register_plugin_assets_directory(app, base_path="/plugins/ctfd_career/static/")

    # Tentativa de rodar migração Alembic (fallback)
    try:
        from CTFd.plugins.migrations import upgrade
        upgrade(plugin_name="ctfd_career")
    except Exception as e:
        print(f"ℹ️  Migração Alembic ignorada: {e}", flush=True)

    print("<<<<< CTFd Career Plugin loaded successfully >>>>>", flush=True)
