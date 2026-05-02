# Yeet2 Ansible

This directory contains the first Yeet2 Ansible deployment path. It ports the useful parts of the older `/Users/icd/workspace/yeet/ansible` fleet work into the current Yeet2 shape: a single Docker host running the release or build-on-host compose stack.

It does **not** bring back the old Nomad/raw-exec fabric yet. Yeet2 still treats Nomad as the future distributed execution substrate; Docker Compose is the supported go-to-woah path today.

## What it does

- Installs Docker Engine and Docker Compose v2.
- Checks out the Yeet2 repository on the target host.
- Renders a host-local `.env` from Ansible variables.
- Starts either `docker-compose.release.yml` or `docker-compose.deploy.yml`.
- Starts remote executor-only workers with `worker-playbook.yml` and `docker-compose.worker.yml`.
- Supports Executor modes including `openhands`, `codex`, `claude`, and `local`.
- Disables the API's local fake worker entry by default so the Workers page reflects real executors.

## Files

- `playbook.yml` provisions and starts the host.
- `worker-playbook.yml` provisions and starts executor-only worker hosts.
- `inventory.ini.example` is a starter inventory for `10.42.10.101`.
- `group_vars/yeet2.yml` contains non-secret defaults.
- `templates/yeet2.env.j2` renders the compose `.env`.
- `requirements.yml` installs the `community.docker` collection.

## Usage

```bash
cd infra/ansible
cp inventory.ini.example inventory.ini
ansible-galaxy collection install -r requirements.yml
ansible-playbook playbook.yml
```

Override secrets and deployment choices with inventory vars, Ansible Vault, or `--extra-vars`:

```bash
ansible-playbook playbook.yml \
  --extra-vars 'yeet2_repo_url=https://github.com/wan0net/yeet2.git' \
  --extra-vars 'yeet2_executor_mode=claude' \
  --extra-vars 'yeet2_anthropic_api_key=...'
```

For Codex/Claude inside the Docker executor image, set:

```ini
yeet2_install_code_harnesses=true
yeet2_executor_mode=codex
```

## Split workers

Keep `10.42.10.100` for Hermes. Run the control plane on `10.42.10.101`, then add a blank worker node such as `10.42.10.102` to `[yeet2_workers]` in `inventory.ini`.

Worker variables should point back at the control-plane API and advertise the worker endpoint:

```ini
[yeet2_workers]
yeet2-worker-01 ansible_host=10.42.10.102

[yeet2_workers:vars]
yeet2_api_base_url=http://10.42.10.101:3001
yeet2_executor_worker_endpoint=http://10.42.10.102:8021
yeet2_executor_mode=claude
yeet2_executor_worker_capabilities=git,claude,codex,implementer,tester,coder,qa,reviewer
```

Deploy or update workers with:

```bash
ansible-playbook worker-playbook.yml --limit yeet2_workers
```

The worker registers with the API, heartbeats into the Workers page, and receives role-capable jobs through GitHub-backed tickets.

## Security notes

- Do not commit `inventory.ini` or rendered `.env` files with real secrets.
- Prefer Ansible Vault for API keys and bearer tokens.
- The old generic Ansible folder contains hardcoded tokens; rotate any live token before reusing that code.
- This playbook does not mount the Docker socket into Yeet2 containers.

## Relationship to old Yeet

The old `/Users/icd/workspace/yeet/ansible` tree is Nomad-oriented and useful as a reference for the future distributed fabric:

- `roles/nomad` installs and configures Nomad.
- `roles/jobs` registers parameterized coding-agent jobs.
- `roles/runtimes` installs Claude Code for host-level execution.
- `roles/git` prepares runner SSH keys and workspaces.

When Yeet2 grows the Nomad executor backend, those concepts should be ported deliberately into `infra/nomad` rather than mixed into this Docker-first playbook.
