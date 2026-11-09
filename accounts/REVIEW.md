# Doctor/patient review version

Fictional patient information only. This version connects to the Singapore development project, not a production patient service.

## Implemented

Email-confirmed patient/practitioner accounts; operator-reviewed practitioner approval; private rooms; practitioner invitation codes; patient-controlled view/edit access; limits of three practitioners per patient and twenty patients per practitioner; versioned lists; author history; conflict handling; English and Traditional Chinese; larger text.

## Review limits

Practitioners remain pending until reviewed. Custom email delivery is configured. Confirmation and recovery support cross-browser links and email codes with the hosted email templates enabled. A live two-account test (patient and demo practitioner in two browsers) passed on 7 November 2026; see PROGRESS.md. Independent-session races have been tested locally; hosted race verification remains pending. Reminders, timers and notifications are design demonstrations only. Care rooms show the guest checker's interaction results, link to its read-only doctor summary and can import a list saved on this device after explicit confirmation. Practitioners can add private tags to their connected patients (visible only to them, deleted when the connection ends). Patients can invite up to three helpers (family members or carers) with single-use codes and choose view or edit; helpers are not checked professionals, never see practitioners or their tags, and the patient can remove them at any time. Patient-created invitations and QR invitations remain unfinished. No real patient information.

The design walkthrough at ./design/ is a separate fictional simulation; it creates no account and sends no medical data.

Source snapshot: ../tools/care-accounts/. To rebuild from that snapshot, set HERBBRIDGE_SITE_ROOT to the repository root and supply the labelled design source at the canonical workspace location. Canonical workspace source: 05_Backend/. No secrets are included.
