import pytest
from backend.audit import audit_logger

def test_audit_logging_and_query():
    initial_count = audit_logger.count_logs()
    
    audit_logger.log(
        actor="test_user",
        action="test.action",
        resource="test_resource",
        details={"key": "value"},
        status="success"
    )

    new_count = audit_logger.count_logs()
    assert new_count == initial_count + 1

    logs = audit_logger.get_logs(limit=1, action_filter="test.action")
    assert len(logs) >= 1
    assert logs[0]["actor"] == "test_user"
    assert logs[0]["action"] == "test.action"
    assert logs[0]["status"] == "success"
