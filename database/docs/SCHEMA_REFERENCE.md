# LIFE database reference

Exactly 10 application tables in public. Supabase-managed auth/storage tables are additional platform tables. These fields/constraints were extracted from the locally installed migrations, not your live project. All UUID id primary keys default to gen_random_uuid() except application_details and staff_roles. Required means NOT NULL; other CHECK constraints can impose additional validation.

## applicants

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `auth_user_id` | uuid | Yes |
| `first_name` | text | Yes |
| `last_name` | text | Yes |
| `email` | text | Yes |
| `phone` | text | No |
| `created_at` | timestamp with time zone | Yes |

Constraints:

- `CHECK ((length(TRIM(BOTH FROM email)) > 0))`
- `CHECK ((length(TRIM(BOTH FROM first_name)) > 0))`
- `CHECK ((length(TRIM(BOTH FROM last_name)) > 0))`
- `FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `NOT NULL auth_user_id`
- `NOT NULL created_at`
- `NOT NULL email`
- `NOT NULL first_name`
- `NOT NULL id`
- `NOT NULL last_name`
- `PRIMARY KEY (id)`
- `UNIQUE (auth_user_id)`

## application_consents

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `application_id` | uuid | Yes |
| `consent_type` | text | Yes |
| `disclosure_version` | text | Yes |
| `disclosure_text` | text | Yes |
| `signer_name` | text | Yes |
| `acknowledged` | boolean | Yes |
| `acknowledged_by` | uuid | Yes |
| `acknowledged_at` | timestamp with time zone | Yes |

Constraints:

- `CHECK ((acknowledged = true))`
- `CHECK ((length(TRIM(BOTH FROM consent_type)) > 0))`
- `CHECK ((length(TRIM(BOTH FROM disclosure_text)) > 0))`
- `CHECK ((length(TRIM(BOTH FROM disclosure_version)) > 0))`
- `CHECK ((length(TRIM(BOTH FROM signer_name)) > 0))`
- `FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT`
- `NOT NULL acknowledged_at`
- `NOT NULL acknowledged_by`
- `NOT NULL acknowledged`
- `NOT NULL application_id`
- `NOT NULL consent_type`
- `NOT NULL disclosure_text`
- `NOT NULL disclosure_version`
- `NOT NULL id`
- `NOT NULL signer_name`
- `PRIMARY KEY (id)`
- `UNIQUE (application_id, consent_type, disclosure_version)`

## application_details

| Field | PostgreSQL type | Required |
|---|---|---|
| `application_id` | uuid | Yes |
| `first_name` | text | Yes |
| `middle_initial` | text | No |
| `last_name` | text | Yes |
| `suffix` | text | No |
| `date_of_birth` | date | No |
| `contact_email` | text | Yes |
| `contact_phone` | text | No |
| `address_line1` | text | No |
| `address_line2` | text | No |
| `city` | text | No |
| `state_code` | text | No |
| `postal_code` | text | No |
| `county` | text | No |
| `household_size` | integer | No |
| `is_life_client` | boolean | No |
| `monthly_income` | numeric | No |
| `household_income` | numeric | No |
| `employment_history` | jsonb | Yes |
| `business_details` | jsonb | Yes |
| `sources_and_uses` | jsonb | Yes |
| `demographics` | jsonb | Yes |
| `created_at` | timestamp with time zone | Yes |
| `updated_at` | timestamp with time zone | Yes |

Constraints:

- `CHECK ((jsonb_typeof(business_details) = 'object'::text))`
- `CHECK ((length(TRIM(BOTH FROM contact_email)) > 0))`
- `CHECK ((date_of_birth >= '1900-01-01'::date))`
- `CHECK ((jsonb_typeof(demographics) = 'object'::text))`
- `CHECK ((jsonb_typeof(employment_history) = 'array'::text))`
- `CHECK ((length(TRIM(BOTH FROM first_name)) > 0))`
- `CHECK (((household_income IS NULL) OR (household_income >= (0)::numeric)))`
- `CHECK (((household_size IS NULL) OR (household_size > 0)))`
- `CHECK ((length(TRIM(BOTH FROM last_name)) > 0))`
- `CHECK (((middle_initial IS NULL) OR (length(middle_initial) <= 1)))`
- `CHECK (((monthly_income IS NULL) OR (monthly_income >= (0)::numeric)))`
- `CHECK (((postal_code IS NULL) OR (postal_code ~ '^[0-9]{5}(-[0-9]{4})?$'::text)))`
- `CHECK ((jsonb_typeof(sources_and_uses) = 'array'::text))`
- `CHECK (((state_code IS NULL) OR (state_code ~ '^[A-Z]{2}$'::text)))`
- `FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT`
- `NOT NULL application_id`
- `NOT NULL business_details`
- `NOT NULL contact_email`
- `NOT NULL created_at`
- `NOT NULL demographics`
- `NOT NULL employment_history`
- `NOT NULL first_name`
- `NOT NULL last_name`
- `NOT NULL sources_and_uses`
- `NOT NULL updated_at`
- `PRIMARY KEY (application_id)`

## application_status_history

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `application_id` | uuid | Yes |
| `old_status` | text | No |
| `new_status` | text | Yes |
| `changed_by` | uuid | Yes |
| `reason` | text | No |
| `changed_at` | timestamp with time zone | Yes |

Constraints:

- `FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT`
- `FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `NOT NULL application_id`
- `NOT NULL changed_at`
- `NOT NULL changed_by`
- `NOT NULL id`
- `NOT NULL new_status`
- `PRIMARY KEY (id)`

## applications

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `applicant_id` | uuid | Yes |
| `submission_key` | uuid | Yes |
| `loan_type` | text | Yes |
| `requested_amount` | numeric | Yes |
| `status` | text | Yes |
| `created_at` | timestamp with time zone | Yes |
| `submitted_at` | timestamp with time zone | No |
| `assigned_reviewer_id` | uuid | No |

Constraints:

- `CHECK ((loan_type = ANY (ARRAY['Personal'::text, 'Business'::text])))`
- `CHECK ((requested_amount > (0)::numeric))`
- `CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'declined'::text])))`
- `CHECK ((((status = 'draft'::text) AND (submitted_at IS NULL)) OR ((status <> 'draft'::text) AND (submitted_at IS NOT NULL))))`
- `FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE RESTRICT`
- `FOREIGN KEY (assigned_reviewer_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `NOT NULL applicant_id`
- `NOT NULL created_at`
- `NOT NULL id`
- `NOT NULL loan_type`
- `NOT NULL requested_amount`
- `NOT NULL status`
- `NOT NULL submission_key`
- `PRIMARY KEY (id)`
- `UNIQUE (submission_key)`

## audit_events

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `actor_user_id` | uuid | No |
| `table_name` | text | Yes |
| `record_key` | text | Yes |
| `operation` | text | Yes |
| `occurred_at` | timestamp with time zone | Yes |

Constraints:

- `CHECK ((operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))`
- `FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `NOT NULL id`
- `NOT NULL occurred_at`
- `NOT NULL operation`
- `NOT NULL record_key`
- `NOT NULL table_name`
- `PRIMARY KEY (id)`

## documents

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `application_id` | uuid | Yes |
| `document_type` | text | Yes |
| `storage_path` | text | Yes |
| `original_filename` | text | Yes |
| `uploaded_at` | timestamp with time zone | Yes |

Constraints:

- `CHECK ((length(TRIM(BOTH FROM document_type)) > 0))`
- `CHECK ((length(TRIM(BOTH FROM original_filename)) > 0))`
- `CHECK ((length(TRIM(BOTH FROM storage_path)) > 0))`
- `FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT`
- `NOT NULL application_id`
- `NOT NULL document_type`
- `NOT NULL id`
- `NOT NULL original_filename`
- `NOT NULL storage_path`
- `NOT NULL uploaded_at`
- `PRIMARY KEY (id)`
- `UNIQUE (storage_path)`

## rating_matrices

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `loan_type` | text | Yes |
| `version` | text | Yes |
| `rules` | jsonb | Yes |
| `approved_by` | uuid | Yes |
| `approved_at` | timestamp with time zone | Yes |
| `effective_from` | timestamp with time zone | Yes |

Constraints:

- `CHECK ((loan_type = ANY (ARRAY['Personal'::text, 'Business'::text])))`
- `CHECK ((jsonb_typeof(rules) = 'object'::text))`
- `CHECK ((length(TRIM(BOTH FROM version)) > 0))`
- `FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `NOT NULL approved_at`
- `NOT NULL approved_by`
- `NOT NULL effective_from`
- `NOT NULL id`
- `NOT NULL loan_type`
- `NOT NULL rules`
- `NOT NULL version`
- `PRIMARY KEY (id)`
- `UNIQUE (loan_type, version)`

## risk_evaluations

| Field | PostgreSQL type | Required |
|---|---|---|
| `id` | uuid | Yes |
| `application_id` | uuid | Yes |
| `matrix_id` | uuid | Yes |
| `evaluation_status` | text | Yes |
| `input_snapshot` | jsonb | Yes |
| `criterion_results` | jsonb | Yes |
| `total_points` | integer | No |
| `rating` | text | No |
| `reason` | text | No |
| `evaluated_by` | uuid | Yes |
| `evaluated_at` | timestamp with time zone | Yes |
| `evaluation_key` | uuid | Yes |

Constraints:

- `CHECK ((((evaluation_status = 'completed'::text) AND (total_points IS NOT NULL) AND (rating IS NOT NULL)) OR ((evaluation_status <> 'completed'::text) AND (rating IS NULL))))`
- `CHECK ((jsonb_typeof(criterion_results) = 'array'::text))`
- `CHECK ((evaluation_status = ANY (ARRAY['pending_inputs'::text, 'manual_review'::text, 'completed'::text, 'error'::text])))`
- `CHECK ((jsonb_typeof(input_snapshot) = 'object'::text))`
- `CHECK (((rating IS NULL) OR (rating = ANY (ARRAY['A+'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text]))))`
- `CHECK (((total_points IS NULL) OR ((total_points >= 0) AND (total_points <= 31))))`
- `FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE RESTRICT`
- `FOREIGN KEY (evaluated_by) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `FOREIGN KEY (matrix_id) REFERENCES rating_matrices(id) ON DELETE RESTRICT`
- `NOT NULL application_id`
- `NOT NULL criterion_results`
- `NOT NULL evaluated_at`
- `NOT NULL evaluated_by`
- `NOT NULL evaluation_key`
- `NOT NULL evaluation_status`
- `NOT NULL id`
- `NOT NULL input_snapshot`
- `NOT NULL matrix_id`
- `PRIMARY KEY (id)`
- `UNIQUE (evaluation_key)`

## staff_roles

| Field | PostgreSQL type | Required |
|---|---|---|
| `user_id` | uuid | Yes |
| `role` | text | Yes |
| `assigned_at` | timestamp with time zone | Yes |

Constraints:

- `CHECK ((role = ANY (ARRAY['reviewer'::text, 'admin'::text])))`
- `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- `NOT NULL assigned_at`
- `NOT NULL role`
- `NOT NULL user_id`
- `PRIMARY KEY (user_id, role)`

## Relationship summary

| Parent | Child / link | Cardinality |
|---|---|---|
| auth.users | applicants.auth_user_id | One account to zero or one profile (unique FK) |
| applicants | applications.applicant_id | One to zero or many |
| auth.users | applications.assigned_reviewer_id | One reviewer to zero or many; each application has zero or one reviewer |
| applications | application_details.application_id | One to zero or one (shared PK/FK) |
| applications | documents.application_id | One to zero or many |
| applications | application_status_history.application_id | One to many (initial event generated) |
| applications | application_consents.application_id | One to zero or many |
| applications | risk_evaluations.application_id | One to zero or many |
| rating_matrices | risk_evaluations.matrix_id | One to zero or many |
| auth.users | staff_roles.user_id | One to zero or many role rows; composite PK(user_id,role) |
| auth.users | status_history.changed_by / consents.acknowledged_by / matrices.approved_by / evaluations.evaluated_by | One account to zero or many action records |
| auth.users | audit_events.actor_user_id | One account to zero or many events; actor may be null for trusted maintenance |

Audit record_key is text, not a foreign key: table_name identifies the referenced table. documents.storage_path is validated against Storage metadata by trigger, not by a foreign key. Stored business/employment/scoring sections use JSONB to keep the table cap; backend owners must validate their client-approved internal structures.
