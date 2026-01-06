# Bash/Zsh completion for update-env.sh
# Source this file: source scripts/env-completion.bash

_update_env_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local prev="${COMP_WORDS[COMP_CWORD-1]}"

  case "$prev" in
    --target|-t)
      COMPREPLY=($(compgen -W "dev staging prod" -- "$cur"))
      return
      ;;
    --file|-f)
      COMPREPLY=($(compgen -f -- "$cur"))
      return
      ;;
  esac

  if [[ "$cur" == -* ]]; then
    COMPREPLY=($(compgen -W "--target --file --all --help -t -f -a -h" -- "$cur"))
  else
    COMPREPLY=($(compgen -f -- "$cur"))
  fi
}

complete -F _update_env_completions update-env.sh
complete -F _update_env_completions ./scripts/update-env.sh
