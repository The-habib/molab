import asyncio
import uuid
import time
import logging
from typing import Dict, List, Optional, Any
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

logger = logging.getLogger("job_manager")

class Job:
    def __init__(self, job_id: str, name: str, job_type: str, payload: dict, owner: str = "admin"):
        self.job_id = job_id
        self.name = name
        self.job_type = job_type
        self.payload = payload
        self.owner = owner
        self.status = "queued"  # queued, running, completed, failed, cancelled
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.logs: List[str] = []
        self.result: Optional[Any] = None
        self.error: Optional[str] = None
        self._task: Optional[asyncio.Task] = None

    def to_dict(self) -> dict:
        duration = None
        if self.started_at:
            end = self.completed_at or time.time()
            duration = round(end - self.started_at, 2)

        return {
            "job_id": self.job_id,
            "name": self.name,
            "type": self.job_type,
            "payload": self.payload,
            "owner": self.owner,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_seconds": duration,
            "result": self.result,
            "error": self.error,
            "log_count": len(self.logs)
        }

    def append_log(self, message: str):
        ts = time.strftime("%H:%M:%S")
        self.logs.append(f"[{ts}] {message}")


class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}

    def list_jobs(self) -> List[dict]:
        sorted_jobs = sorted(self.jobs.values(), key=lambda j: j.created_at, reverse=True)
        return [j.to_dict() for j in sorted_jobs]

    def get_job(self, job_id: str) -> Optional[Job]:
        return self.jobs.get(job_id)

    async def submit_job(self, name: str, job_type: str, payload: dict, owner: str = "admin") -> Job:
        job_id = f"job-{uuid.uuid4().hex[:8]}"
        job = Job(job_id=job_id, name=name, job_type=job_type, payload=payload, owner=owner)
        self.jobs[job_id] = job
        
        audit_logger.log(actor=owner, action="job.submit", resource=job_id, details={"name": name, "type": job_type})
        
        # Schedule execution in background
        task = asyncio.create_task(self._run_job(job))
        job._task = task
        return job

    async def cancel_job(self, job_id: str, actor: str = "admin") -> bool:
        job = self.jobs.get(job_id)
        if not job or job.status in ["completed", "failed", "cancelled"]:
            return False

        if job._task and not job._task.done():
            job._task.cancel()

        job.status = "cancelled"
        job.completed_at = time.time()
        job.append_log("Job was cancelled by administrator.")
        audit_logger.log(actor=actor, action="job.cancel", resource=job_id)
        return True

    async def _run_job(self, job: Job):
        job.status = "running"
        job.started_at = time.time()
        job.append_log(f"Starting job: {job.name} (type: {job.job_type})")

        try:
            if not agent_manager.is_online:
                raise ConnectionError("Remote Cloud PC is offline; cannot execute remote job.")

            job.append_log("Dispatching job payload to remote agent...")
            result = await agent_manager.call_rpc("execute_job", {
                "job_id": job.job_id,
                "job_type": job.job_type,
                "payload": job.payload
            }, timeout=300.0)

            job.status = "completed"
            job.completed_at = time.time()
            job.result = result
            job.append_log(f"Job completed successfully in {round(job.completed_at - job.started_at, 2)}s.")
            audit_logger.log(actor=job.owner, action="job.complete", resource=job.job_id, status="success")

        except asyncio.CancelledError:
            job.status = "cancelled"
            job.completed_at = time.time()
            job.append_log("Job execution was cancelled.")
        except Exception as e:
            job.status = "failed"
            job.completed_at = time.time()
            job.error = str(e)
            job.append_log(f"Job failed with error: {e}")
            audit_logger.log(actor=job.owner, action="job.fail", resource=job.job_id, details=str(e), status="failed")

job_manager = JobManager()
