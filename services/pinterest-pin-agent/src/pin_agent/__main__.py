from __future__ import annotations

import logging
import signal
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .config import get_settings
from .runner import run_once

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("pin_agent")


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    settings = get_settings()

    if not argv or argv[0] in {"once", "run-once"}:
        result = run_once(settings)
        logger.info("Result: %s", result.get("status"))
        return 0

    if argv[0] in {"schedule", "daemon", "serve"}:
        scheduler = BlockingScheduler(timezone=settings.pin_timezone)

        def job() -> None:
            try:
                run_once(get_settings())
            except Exception:  # noqa: BLE001
                logger.exception("Pin cycle failed")

        hours = max(float(settings.pin_interval_hours), 0.25)
        scheduler.add_job(job, IntervalTrigger(hours=hours), id="pin_cycle", max_instances=1)
        logger.info(
            "Scheduler started: every %s hour(s), mode=%s, tz=%s",
            hours,
            settings.pin_agent_mode,
            settings.pin_timezone,
        )

        # Run one cycle on boot so you see activity without waiting the full interval
        job()

        def _shutdown(signum, frame):  # noqa: ANN001, ARG001
            logger.info("Shutting down scheduler (signal %s)", signum)
            scheduler.shutdown(wait=False)

        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            pass
        return 0

    if argv[0] == "health":
        print("ok")
        return 0

    logger.error("Unknown command: %s (use once|schedule|health)", argv[0])
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
