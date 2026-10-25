"""Research modules share an immutable installed-family-index write boundary."""
from .mutation_guard import install as _install_history_mutation_fence
_install_history_mutation_fence()
