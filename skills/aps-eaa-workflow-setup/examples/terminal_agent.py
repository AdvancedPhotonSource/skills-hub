"""Hub-authored terminal EAA example; see ../references/integration.md."""

import argparse
import os
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Start an EAA terminal agent.")
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--skill-dir", action="append", default=[], type=Path)
    parser.add_argument("--provider", choices=("openai", "argo"), default="openai")
    args = parser.parse_args()
    for key in ("EAA_MODEL", "EAA_BASE_URL", "EAA_API_KEY"):
        if not os.environ.get(key):
            parser.error(f"Set {key} for the selected model service.")
    skill_dirs = [str(path.expanduser().resolve()) for path in args.skill_dir]
    if any(not Path(path).is_dir() for path in skill_dirs):
        parser.error("Every --skill-dir must be an existing extracted skill directory or parent.")

    from eaa_core.api.llm_config import ArgoConfig, OpenAIConfig
    from eaa_core.task_manager.base import BaseTaskManager
    from eaa_core.tool.example_calculator import CalculatorTool
    from eaa_core.tool.workspace import FileSystemTool

    workspace = args.workspace.expanduser().resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    os.chdir(workspace)
    config_type = ArgoConfig if args.provider == "argo" else OpenAIConfig
    manager = BaseTaskManager(
        llm_config=config_type(
            model=os.environ["EAA_MODEL"],
            base_url=os.environ["EAA_BASE_URL"],
            api_key=os.environ["EAA_API_KEY"],
        ),
        tools=[
            CalculatorTool(),
            FileSystemTool(workspace_path=str(workspace), read_whitelist_paths=skill_dirs),
        ],
        skill_dirs=skill_dirs,
        checkpoint_db_path=str(workspace / "checkpoint.sqlite"),
        transcript_db_path=str(workspace / "transcript.sqlite"),
        use_webui=False,
    )
    manager.run_conversation()


if __name__ == "__main__":
    main()
