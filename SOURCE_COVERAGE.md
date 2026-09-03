# Source Coverage & Engineering Audit

Source: `Software instruction.pdf` (96 pages, image-based PDF).

## Read/checked
The complete 96-page PDF was rendered/inspected in page ranges. The document is image-based; native text extraction returned no usable text, so page images were used as the authoritative reading surface.

## Explicit master counts captured
- Corporate: 18
- Departments: 91
- Sections: 156
- Designations: 564

## Core requirements captured
1. Main sidebar / corporate management controls.
2. 91-department master.
3. 156-section master.
4. 564-designation master.
5. Department → Section → Designation linkage model.
6. Department responsibility fields.
7. Section responsibility fields.
8. Designation responsibility/evaluation fields.
9. Daily → weekly → monthly → quarterly → half-yearly → annual evaluation model.
10. ISO mapping: standard → clause/requirement → process → responsibility → checklist → evidence → KPI → evaluation.
11. Task lifecycle: created → assigned → accepted/in progress → pending approval → approved → completed → verified → closed.
12. Overdue / escalation concept.
13. Real-time synchronization concept.
14. Smart checklist center.
15. Document/import concept for PDF, Excel, CSV, Word, image, audio and video.
16. HRM employee lifecycle.
17. Attendance and payroll.
18. Training and competency.
19. Welfare, medical and grievance.
20. Compliance, ISO/IMS, internal/external/buyer audit.
21. Risk and CAPA / continual improvement.
22. HSE, environmental, waste, chemical and energy management.
23. Production, IE, planning, fabric, accessories, procurement, inventory, traceability.
24. Quality, laboratory/testing/calibration and product safety.
25. Maintenance, electrical and utility.
26. Commercial, finance and shipment.
27. IT/security/information security.
28. Management communication and acknowledgement.
29. KPI/performance dashboards.
30. Role/permission system.
31. Master dashboards and employee dashboards.
32. Attendance machine/GPS-oriented location/punch architecture.
33. Salary import/reconciliation and historical employee handling.
34. 72-hour / weekly working-hour monitoring concept.
35. Firebase/GitHub deployment context.

## Important source limitations preserved
The PDF states that every designation should be mapped to its appropriate Department and Section, but it does not provide a complete individual mapping table for all 564 designations. Therefore the build contains the complete 564-designation registry while treating the final Department→Section→Designation assignment as configurable master data rather than inventing mappings.

Likewise, some PDF pages describe optional/in-house processes (for example knitting, dyeing, washing, printing, embroidery). These are represented as specialized modules that can be activated/deactivated rather than assuming every factory has every process.
