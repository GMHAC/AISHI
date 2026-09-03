# PostgreSQL aggregation contract for dashboards.
SECTION_QUERY = '''
SELECT
 COUNT(*) FILTER (WHERE status='OPEN') AS open_items,
 COUNT(*) FILTER (WHERE status='IN_PROGRESS') AS in_progress,
 COUNT(*) FILTER (WHERE status='OVERDUE') AS overdue,
 COUNT(*) FILTER (WHERE status='APPROVED') AS approved
FROM work_item
WHERE section_id=:section_id;
'''

DEPARTMENT_QUERY = '''
SELECT section_id,status,COUNT(*) AS total
FROM work_item
WHERE department_id=:department_id
GROUP BY section_id,status;
'''

MANAGEMENT_QUERY = '''
SELECT department_id,status,COUNT(*) AS total
FROM work_item
GROUP BY department_id,status;
'''
