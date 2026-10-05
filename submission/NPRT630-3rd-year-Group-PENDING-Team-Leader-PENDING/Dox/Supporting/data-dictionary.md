# Complete source-based data dictionary

This is a source inventory, not an export of the live database. JPA defaults and unverified types are labelled. See report pp.13–15 for drift and constraints.

## admin_platform_settings
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| id | BIGINT | - | Primary key | SQL source; live DDL not inspected |
| university_name | VARCHAR | 160 | Institution label | SQL source; live DDL not inspected |
| email_domain | VARCHAR | 120 | Configured email domain | SQL source; live DDL not inspected |
| campus_security_phone | VARCHAR | 40 | Configured phone | SQL source; live DDL not inspected |
| sos_response_time_seconds | INT | - | Configuration target | SQL source; live DDL not inspected |
| first_year_priority_matching | BOOLEAN | - | Configured preference | SQL source; live DDL not inspected |
| updated_at | DATETIME | - | Last save | SQL source; live DDL not inspected |

## drivers
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| driver_id | BIGINT | not specified | Primary key | JPA logical mapping; live DDL not inspected |
| user_id | BIGINT | not specified | user Id | JPA logical mapping; live DDL not inspected |
| licence_plate | VARCHAR | 255 (JPA default) | licence Plate | JPA logical mapping; live DDL not inspected |
| vehicle_make | VARCHAR | 255 (JPA default) | vehicle Make | JPA logical mapping; live DDL not inspected |
| vehicle_year | INT | not specified | vehicle Year | JPA logical mapping; live DDL not inspected |
| vehicle_photo | LONGTEXT | variable | vehicle Photo | JPA logical mapping; live DDL not inspected |
| rating | DECIMAL (precision unspecified) | not specified | rating | JPA logical mapping; live DDL not inspected |
| total_trips | INT | not specified | total Trips | JPA logical mapping; live DDL not inspected |
| online | BOOLEAN | not specified | online | JPA logical mapping; live DDL not inspected |
| approval_status | ENUM ApprovalStatus | not specified | approval Status | JPA logical mapping; live DDL not inspected |

## messages
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| message_id | BIGINT | not specified | Primary key | JPA logical mapping; live DDL not inspected |
| ride_id | BIGINT | not specified | ride Id | JPA logical mapping; live DDL not inspected |
| sender_id | BIGINT | not specified | sender Id | JPA logical mapping; live DDL not inspected |
| message_text | VARCHAR | 1000 | message Text | JPA logical mapping; live DDL not inspected |
| sent_at | DATETIME | not specified | sent At | JPA logical mapping; live DDL not inspected |

## password_reset_codes
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| id | BIGINT | not specified | Primary key | JPA logical mapping; live DDL not inspected |
| email | VARCHAR | 255 | email | JPA logical mapping; live DDL not inspected |
| code_hash | VARCHAR | 255 | code Hash | JPA logical mapping; live DDL not inspected |
| expires_at | DATETIME | not specified | expires At | JPA logical mapping; live DDL not inspected |
| created_at | DATETIME | not specified | created At | JPA logical mapping; live DDL not inspected |
| attempts | INT | not specified | attempts | JPA logical mapping; live DDL not inspected |

## payments
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| ride_id | ID type unverified | UNVERIFIED | Trip | Insert contract only; creation DDL missing |
| payer_id | ID type unverified | UNVERIFIED | Payer | Insert contract only; creation DDL missing |
| amount | Numeric type unverified | UNVERIFIED | Fare record | Insert contract only; creation DDL missing |
| method | ENUM/string unverified | UNVERIFIED | CASH/CARD; expanded enum migration | Insert contract only; creation DDL missing |
| status | String/enum unverified | UNVERIFIED | PENDING inserted | Insert contract only; creation DDL missing |
| transaction_ref | String unverified | UNVERIFIED | Reference; no settlement | Insert contract only; creation DDL missing |

## rides
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| ride_id | BIGINT | not specified | Primary key | JPA logical mapping; live DDL not inspected |
| rider_id | BIGINT | not specified | rider Id | JPA logical mapping; live DDL not inspected |
| driver_id | BIGINT | not specified | driver Id | JPA logical mapping; live DDL not inspected |
| pickup_location | VARCHAR | 255 (JPA default) | pickup Location | JPA logical mapping; live DDL not inspected |
| destination | VARCHAR | 255 (JPA default) | destination | JPA logical mapping; live DDL not inspected |
| pickup_lat | DOUBLE | not specified | pickup Lat | JPA logical mapping; live DDL not inspected |
| pickup_lng | DOUBLE | not specified | pickup Lng | JPA logical mapping; live DDL not inspected |
| dest_lat | DOUBLE | not specified | dest Lat | JPA logical mapping; live DDL not inspected |
| dest_lng | DOUBLE | not specified | dest Lng | JPA logical mapping; live DDL not inspected |
| current_lat | DOUBLE | not specified | current Lat | JPA logical mapping; live DDL not inspected |
| current_lng | DOUBLE | not specified | current Lng | JPA logical mapping; live DDL not inspected |
| fare | DECIMAL (precision unspecified) | not specified | fare | JPA logical mapping; live DDL not inspected |
| distance_km | DOUBLE | not specified | distance Km | JPA logical mapping; live DDL not inspected |
| duration_min | DOUBLE | not specified | duration Minutes | JPA logical mapping; live DDL not inspected |
| status | ENUM RideStatus | not specified | status | JPA logical mapping; live DDL not inspected |
| scheduled_at | DATETIME | not specified | scheduled At | JPA logical mapping; live DDL not inspected |
| started_at | DATETIME | not specified | started At | JPA logical mapping; live DDL not inspected |
| completed_at | DATETIME | not specified | completed At | JPA logical mapping; live DDL not inspected |
| cancellation_reason | VARCHAR | 500 | cancellation Reason | JPA logical mapping; live DDL not inspected |
| cancelled_by | BIGINT | not specified | cancelled By | JPA logical mapping; live DDL not inspected |
| rider_rating | INT | not specified | rider Rating | JPA logical mapping; live DDL not inspected |
| rider_rating_comment | VARCHAR | 500 | rider Rating Comment | JPA logical mapping; live DDL not inspected |
| driver_rating | INT | not specified | driver Rating | JPA logical mapping; live DDL not inspected |
| driver_rating_comment | VARCHAR | 500 | driver Rating Comment | JPA logical mapping; live DDL not inspected |
| created_at | DATETIME | not specified | created At | JPA logical mapping; live DDL not inspected |

## sos_alerts
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| alert_id | BIGINT | not specified | Primary key | JPA logical mapping; live DDL not inspected |
| ride_id | BIGINT | not specified | ride Id | JPA logical mapping; live DDL not inspected |
| triggered_by | BIGINT | not specified | triggered By | JPA logical mapping; live DDL not inspected |
| gps_lat | DOUBLE | not specified | gps Lat | JPA logical mapping; live DDL not inspected |
| gps_lng | DOUBLE | not specified | gps Lng | JPA logical mapping; live DDL not inspected |
| audio_file_path | VARCHAR | 500 | audio File Path | JPA logical mapping; live DDL not inspected |
| recording_duration | INT | not specified | recording Duration | JPA logical mapping; live DDL not inspected |
| status | VARCHAR | 30 | status | JPA logical mapping; live DDL not inspected |
| created_at | DATETIME | not specified | created At | JPA logical mapping; live DDL not inspected |
| resolved_at | DATETIME | - | Resolution time | SQL source; live DDL not inspected |
| resolved_by | BIGINT | - | Resolving user ID | SQL source; live DDL not inspected |

## user_payment_methods
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| id | BIGINT | - | Primary key | SQL source; live DDL not inspected |
| user_id | BIGINT | - | Owning user | SQL source; live DDL not inspected |
| label | VARCHAR | 80 | Display label | SQL source; live DDL not inspected |
| last_four | CHAR | 4 | Last four digits | SQL source; live DDL not inspected |
| brand | VARCHAR | 32 | Card brand | SQL source; live DDL not inspected |
| expiry | CHAR | 5 | MM/YY expiry | SQL source; live DDL not inspected |
| cardholder | VARCHAR | 120 | Display name | SQL source; live DDL not inspected |
| is_default | BOOLEAN | - | Default flag | SQL source; live DDL not inspected |
| created_at | DATETIME | - | Creation time | SQL source; live DDL not inspected |

## users
| Field | Type | Size | Description | Evidence |
|---|---|---|---|---|
| user_id | BIGINT | not specified | Primary key | JPA logical mapping; live DDL not inspected |
| full_name | VARCHAR | 255 (JPA default) | full Name | JPA logical mapping; live DDL not inspected |
| email | VARCHAR | 255 (JPA default) | email | JPA logical mapping; live DDL not inspected |
| password_hash | VARCHAR | 255 (JPA default) | password Hash | JPA logical mapping; live DDL not inspected |
| role | ENUM Role | not specified | role | JPA logical mapping; live DDL not inspected |
| year_of_study | INT | not specified | year Of Study | JPA logical mapping; live DDL not inspected |
| emergency_contact | VARCHAR | 255 (JPA default) | emergency Contact | JPA logical mapping; live DDL not inspected |
| student_number | VARCHAR | 255 (JPA default) | student Number | JPA logical mapping; live DDL not inspected |
| phone | VARCHAR | 255 (JPA default) | phone | JPA logical mapping; live DDL not inspected |
| profile_photo | LONGTEXT | variable | profile Photo | JPA logical mapping; live DDL not inspected |
| licence_plate | VARCHAR | 255 (JPA default) | licence Plate | JPA logical mapping; live DDL not inspected |
| vehicle_make | VARCHAR | 255 (JPA default) | vehicle Make | JPA logical mapping; live DDL not inspected |
| vehicle_year | INT | not specified | vehicle Year | JPA logical mapping; live DDL not inspected |
| face_verified | BOOLEAN | not specified | face Verified | JPA logical mapping; live DDL not inspected |
| face_embedding | TEXT | variable | face Embedding | JPA logical mapping; live DDL not inspected |
| status | ENUM UserStatus | not specified | status | JPA logical mapping; live DDL not inspected |
| created_at | DATETIME | not specified | created At | JPA logical mapping; live DDL not inspected |
| default_payment_method | VARCHAR | 20 | Default payment preference | SQL source; live DDL not inspected |
