# ============================================================
# MASTER SPECIFICATION
# UNIVERSAL ENTERPRISE BUSINESS PLATFORM
# 2026–2027
# ============================================================

ROLE

You are the Principal Enterprise Architect, Backend Architect,
Frontend Architect, Database Architect, Security Architect,
DevOps Engineer, POS Engineer, Mobile Engineer, Integration
Engineer, AI Engineer, QA Engineer and Product Architect.

Build a complete enterprise platform that can support many
business types and many channels from one common platform.

THIS IS A PLATFORM, NOT A SIMPLE CRUD APPLICATION.

The platform must support:

- Retail
- Wholesale
- Supermarket
- Convenience Store
- Restaurant
- Cafe
- Bar
- Food & Beverage
- Fuel Station
- Pharmacy
- Electronics
- Mobile Shop
- Clothing
- Fashion
- Cosmetics
- Beauty
- Hardware
- Construction Materials
- Automotive
- Spare Parts
- Warehouse
- Distribution
- E-Commerce
- Services
- Subscription
- B2B
- B2C
- Marketplace
- Franchise
- Multi-company
- Multi-branch
- Multi-country

The system must be configurable by business type.

DO NOT hard-code one industry into the core platform.


# ============================================================
# 1. REQUIRED TECHNOLOGY STACK
# ============================================================

Use the following stack unless an explicit technical blocker
requires a change.

WEB
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

BACKEND
- NestJS
- TypeScript
- REST
- OpenAPI
- Swagger

DATABASE
- PostgreSQL
- Prisma
- Redis

BACKGROUND JOBS
- BullMQ

OBJECT STORAGE
- MinIO
- S3-compatible architecture

MONOREPO
- pnpm
- Turborepo

POS
- Electron
- React
- TypeScript
- SQLite/local database
- Offline-first architecture

MOBILE
- Flutter

TELEGRAM
- Telegram Mini App
- Telegram Bot

OBSERVABILITY
- OpenTelemetry
- Prometheus
- Grafana

CONTAINER
- Docker
- Docker Compose

FUTURE SCALE
- Kubernetes-ready
- Kafka-ready
- Temporal-ready
- OpenSearch-ready

IMPORTANT:

Do not silently replace technology.

If you believe another technology is better:
1. Explain why.
2. Compare against the specified technology.
3. Ask for approval.
4. Do not change the stack automatically.


# ============================================================
# 2. OVERALL PLATFORM
# ============================================================

Architecture:

CLIENTS
|
+-- Web
+-- Enterprise Admin
+-- POS
+-- Mobile
+-- Telegram Mini App
+-- Telegram Bot
+-- Customer Portal
+-- Staff Portal
+-- Partner Portal
+-- Third Party Applications
|
v
API GATEWAY
|
v
IDENTITY / AUTHORIZATION
|
v
BUSINESS SERVICES
|
+-- Organization
+-- Product
+-- Customer
+-- Sales
+-- Order
+-- Inventory
+-- Warehouse
+-- Procurement
+-- Finance
+-- Accounting
+-- CRM
+-- HR
+-- Manufacturing
+-- Logistics
+-- Delivery
+-- Asset
+-- Maintenance
+-- Service Management
+-- Project
|
v
PLATFORM SERVICES
|
+-- Notification
+-- Workflow
+-- Automation
+-- Storage
+-- Document
+-- Search
+-- Reporting
+-- Analytics
+-- Audit
+-- Integration
+-- Partner
+-- Developer
+-- Configuration
+-- Feature Flags
+-- AI
|
v
DATA PLATFORM
|
+-- PostgreSQL
+-- Redis
+-- Object Storage
+-- Event Bus
+-- Search Index
+-- Analytics Storage


# ============================================================
# 3. IDENTITY SERVICE
# ============================================================

Purpose:
Central authentication and identity.

Features:

- User registration
- Login
- Logout
- Refresh token
- Password reset
- Email verification
- MFA
- OTP
- OIDC
- OAuth2
- Session management
- Device management
- API authentication
- Service accounts
- Machine-to-machine authentication
- Password policies
- Account lockout
- Session revocation
- Security alerts
- Login history

Entities:

- User
- Credential
- Session
- Device
- Identity
- Service Account
- OAuth Client
- API Client

APIs:

POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/mfa
GET  /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:id

Events:

USER_CREATED
USER_LOGIN
USER_LOGOUT
PASSWORD_CHANGED
MFA_ENABLED
SESSION_REVOKED


# ============================================================
# 4. ORGANIZATION SERVICE
# ============================================================

Manage enterprise hierarchy.

Structure:

Organization
  Company
    Business Unit
      Region
        Branch
          Department
            Warehouse
            POS

Features:

- organizations
- companies
- business units
- branches
- departments
- locations
- cost centers
- profit centers
- operating units
- business hours
- holidays
- fiscal calendars

Support:

- multi-company
- multi-branch
- multi-country
- multi-currency
- multi-language

APIs:

GET /organizations
POST /organizations
GET /organizations/:id
PUT /organizations/:id
DELETE /organizations/:id

Events:

ORGANIZATION_CREATED
BRANCH_CREATED
DEPARTMENT_CREATED


# ============================================================
# 5. ROLE & PERMISSION SERVICE
# ============================================================

Support:

RBAC
resource permissions
record permissions
branch permissions
department permissions
organization permissions
API scopes

Roles:

SUPER_ADMIN
PLATFORM_ADMIN
ORG_ADMIN
COMPANY_ADMIN
BRANCH_MANAGER
FINANCE_MANAGER
SALES_MANAGER
WAREHOUSE_MANAGER
CASHIER
ACCOUNTANT
HR_MANAGER
STAFF
AUDITOR
CUSTOMER
PARTNER

Permissions:

CREATE
READ
UPDATE
DELETE
APPROVE
EXPORT
DOWNLOAD
SHARE
REFUND
MANAGE_PERMISSION
MANAGE_CONFIGURATION

Example:

Finance Manager
-> approve invoice
-> only Company A
-> only Branch B

Never trust permissions received from frontend.


# ============================================================
# 6. MASTER DATA SERVICE
# ============================================================

Central management of master data.

Features:

- countries
- currencies
- units
- tax codes
- categories
- brands
- locations
- payment methods
- document types
- customer types
- supplier types
- product attributes
- status definitions

Prevent duplicate master data.


# ============================================================
# 7. PRODUCT SERVICE
# ============================================================

Universal product system.

Product types:

- physical product
- service
- digital product
- bundle
- combo
- kit
- package
- ingredient
- raw material
- spare part
- asset
- subscription
- gift card
- voucher

Fields:

- SKU
- barcode
- multiple barcode
- name
- description
- category
- brand
- model
- variant
- size
- color
- weight
- volume
- unit
- tax
- cost
- price
- supplier
- manufacturer
- country
- warranty
- serializable
- batchable
- expirable
- image
- documents
- tags
- status

Support custom attributes.

Example:

CAFE:
Size, Sugar, Ice, Milk

CLOTHING:
Size, Color

ELECTRONICS:
IMEI, Serial Number

AUTOMOTIVE:
OEM, Vehicle Compatibility


# ============================================================
# 8. PRODUCT VARIANT SERVICE
# ============================================================

Support product matrices.

Example:

T-Shirt
- Small / Black
- Medium / Black
- Large / Black
- Small / White

Each variant can have:

- SKU
- barcode
- price
- stock
- image
- weight
- cost


# ============================================================
# 9. PRICING SERVICE
# ============================================================

Central pricing engine.

Price types:

- retail
- wholesale
- distributor
- member
- employee
- branch
- online
- POS
- customer specific
- campaign
- time-based

Rules:

- quantity
- customer
- branch
- date
- time
- membership
- product
- category

Never calculate important financial pricing only on frontend.


# ============================================================
# 10. PROMOTION SERVICE
# ============================================================

Support:

- percentage discount
- fixed discount
- Buy 1 Get 1
- Buy 2 Get 1
- bundle
- combo
- multi-buy
- coupon
- voucher
- happy hour
- happy day
- member discount
- birthday
- first order
- branch promotion
- category promotion

Support priority and conflict rules.


# ============================================================
# 11. CUSTOMER SERVICE
# ============================================================

Customer management.

Features:

- individual customers
- business customers
- contacts
- addresses
- billing address
- shipping address
- customer groups
- credit limits
- payment terms
- customer status
- customer documents
- preferences
- consent
- customer history

Customer 360 view:

- sales
- orders
- payments
- invoices
- returns
- refunds
- support
- loyalty
- subscriptions
- messages


# ============================================================
# 12. CRM SERVICE
# ============================================================

Features:

- leads
- opportunities
- accounts
- contacts
- activities
- notes
- tasks
- campaigns
- segments
- customer journey
- sales pipeline
- follow-up
- communication history

Pipeline:

Lead
-> Qualified
-> Opportunity
-> Quote
-> Won/Lost


# ============================================================
# 13. SALES SERVICE
# ============================================================

Sales lifecycle:

Quote
-> Order
-> Fulfillment
-> Invoice
-> Payment
-> Settlement

Features:

- quotations
- orders
- sales
- refunds
- returns
- exchanges
- discounts
- commissions
- sales targets
- sales reps

All channels use the same sales engine:

- POS
- Web
- Mobile
- Telegram
- B2B
- Partner API
- Marketplace


# ============================================================
# 14. ORDER SERVICE
# ============================================================

Support:

- order creation
- order modification
- cancellation
- fulfillment
- partial fulfillment
- split fulfillment
- order status
- delivery
- pickup
- returns

Statuses:

DRAFT
PENDING
CONFIRMED
PROCESSING
READY
SHIPPED
DELIVERED
CANCELLED
REFUNDED


# ============================================================
# 15. POS SERVICE
# ============================================================

POS support:

- cashier login
- terminal
- shift
- cash drawer
- barcode
- product lookup
- customer lookup
- discount
- promotion
- payment
- receipt
- invoice
- refund
- return
- exchange
- split payment
- suspended sale
- reprint receipt
- day closing

POS types:

- retail POS
- supermarket POS
- restaurant POS
- cafe POS
- bar POS
- fuel POS
- pharmacy POS
- electronics POS
- service POS
- wholesale POS


# ============================================================
# 16. POS OFFLINE SERVICE
# ============================================================

POS must continue operating during temporary network failure.

Architecture:

POS
-> local SQLite
-> sync queue
-> backend

Features:

- offline sales
- offline product cache
- offline customer lookup
- transaction queue
- retry
- sync status
- conflict resolution
- idempotency
- duplicate prevention

Every transaction must have unique ID.

Never duplicate sales because of retry.


# ============================================================
# 17. RESTAURANT SERVICE
# ============================================================

Features:

- tables
- rooms
- zones
- reservations
- dine-in
- takeaway
- delivery
- kitchen orders
- kitchen display
- kitchen printer
- courses
- modifiers
- combo
- tips
- service charge
- split bills
- merge bills

Kitchen flow:

Order
-> Kitchen
-> Preparing
-> Ready
-> Served


# ============================================================
# 18. FOOD / RECIPE SERVICE
# ============================================================

Support:

- recipes
- ingredients
- BOM
- recipe versions
- food cost
- waste
- yield
- ingredient substitution

Example:

Coffee Beans
Milk
Sugar
Ice
Cup
=
Iced Coffee

When product is sold, inventory consumes recipe ingredients.


# ============================================================
# 19. BEVERAGE SERVICE
# ============================================================

Support:

Water
Soft Drink
Energy Drink
Juice
Coffee
Tea
Milk
Beer
Wine
Spirits
Cocktail
Mocktail

Modifiers:

Size
Temperature
Ice Level
Sugar Level
Milk
Syrup
Toppings
Extra Shot

Pricing must support modifier combinations.


# ============================================================
# 20. BAR SERVICE
# ============================================================

Features:

- open tab
- table tab
- bar tab
- bottle tracking
- drink recipe
- happy hour
- time-based pricing
- split payment
- shared tab


# ============================================================
# 21. FUEL SERVICE
# ============================================================

Features:

- fuel products
- fuel price
- pump
- nozzle
- dispenser
- tank
- tank level
- meter
- fuel volume
- attendant
- shift
- reconciliation
- daily closing

Integration abstraction for external fuel equipment.


# ============================================================
# 22. PHARMACY SERVICE
# ============================================================

Support configurable:

- medicine/products
- batch
- expiry
- FEFO
- prescription reference
- customer/patient
- recall
- quarantine
- controlled-product rules where legally applicable

Country-specific regulations must be configurable.


# ============================================================
# 23. INVENTORY SERVICE
# ============================================================

Inventory states:

ON_HAND
AVAILABLE
RESERVED
DAMAGED
EXPIRED
QUARANTINED

Features:

- stock receipt
- stock issue
- stock transfer
- stock adjustment
- stock count
- cycle count
- reservation
- release
- inventory valuation
- stock movement history


# ============================================================
# 24. UNIT OF MEASURE SERVICE
# ============================================================

Support:

- piece
- box
- pack
- carton
- bottle
- can
- case
- kg
- gram
- liter
- ml
- meter
- roll
- set
- pair
- dozen

Conversions:

1 carton = 24 bottles
1 bottle = 500 ml

Support product-specific conversion rules.


# ============================================================
# 25. BATCH / LOT SERVICE
# ============================================================

Features:

- batch
- lot
- manufacture date
- expiry date
- best before
- supplier batch
- recall

Methods:

FIFO
FEFO

Alerts:

- expiring soon
- expired
- recalled


# ============================================================
# 26. SERIAL NUMBER SERVICE
# ============================================================

For electronics/assets.

Track:

- serial number
- IMEI
- MAC
- asset number
- warranty
- ownership
- location
- lifecycle


# ============================================================
# 27. WAREHOUSE SERVICE
# ============================================================

Features:

- warehouse
- zone
- bin
- receiving
- putaway
- picking
- packing
- shipping
- returns
- transfer
- cycle count
- barcode scanning

Prepare for mobile handheld scanners.


# ============================================================
# 28. PROCUREMENT SERVICE
# ============================================================

Procure-to-Pay:

Purchase Request
-> Approval
-> RFQ
-> Supplier Quote
-> Purchase Order
-> Goods Receipt
-> Invoice
-> 3-Way Match
-> Payment

Support:

- supplier comparison
- price history
- approval
- contracts
- purchase limits


# ============================================================
# 29. SUPPLIER SERVICE
# ============================================================

Features:

- supplier profile
- contacts
- products
- contracts
- price lists
- payment terms
- bank information
- supplier score
- supplier performance
- supplier documents


# ============================================================
# 30. FINANCE SERVICE
# ============================================================

Support:

- general ledger
- chart of accounts
- journals
- accounting periods
- posting
- closing
- opening balance
- financial rules

Do not mix financial logic into POS screens.


# ============================================================
# 31. ACCOUNTS RECEIVABLE
# ============================================================

Features:

- invoices
- receipts
- customer balance
- credit limits
- aging
- collections
- overdue
- credit notes
- debit notes


# ============================================================
# 32. ACCOUNTS PAYABLE
# ============================================================

Features:

- supplier invoices
- payable balance
- aging
- payment schedule
- approval
- credit note
- debit note


# ============================================================
# 33. PAYMENT SERVICE
# ============================================================

Payment abstraction.

Methods:

- cash
- card
- QR
- bank transfer
- wallet
- payment gateway
- credit
- split payment

Provider interface:

PaymentProvider
- authorize
- capture
- refund
- void
- status
- reconcile

Providers must be replaceable.


# ============================================================
# 34. BANK RECONCILIATION
# ============================================================

Features:

- bank account
- statement import
- transaction matching
- automatic matching
- manual matching
- reconciliation
- difference detection


# ============================================================
# 35. TAX SERVICE
# ============================================================

Configurable:

- tax rates
- tax included
- tax excluded
- tax exempt
- product tax
- service tax
- customer tax status
- branch tax
- country tax rules


# ============================================================
# 36. BUDGET SERVICE
# ============================================================

Features:

- annual budget
- department budget
- branch budget
- project budget
- revenue budget
- expense budget
- budget vs actual
- forecast
- approvals


# ============================================================
# 37. FIXED ASSET SERVICE
# ============================================================

Features:

- asset register
- acquisition
- depreciation
- transfer
- location
- maintenance
- warranty
- disposal
- asset history


# ============================================================
# 38. EXPENSE SERVICE
# ============================================================

Support:

- employee expenses
- branch expenses
- petty cash
- travel
- utilities
- maintenance
- expense claims
- approval


# ============================================================
# 39. HR SERVICE
# ============================================================

Features:

- employee
- department
- position
- employment
- contract
- attendance
- leave
- shift
- timesheet
- performance
- recruitment
- onboarding
- offboarding
- training
- documents

Payroll must be configurable by country.


# ============================================================
# 40. WORKFORCE SERVICE
# ============================================================

Features:

- roster
- scheduling
- shift planning
- overtime
- attendance
- capacity
- staff assignment


# ============================================================
# 41. PROJECT SERVICE
# ============================================================

Features:

- projects
- tasks
- milestones
- budgets
- resources
- timesheets
- expenses
- documents
- profitability


# ============================================================
# 42. SERVICE MANAGEMENT
# ============================================================

Support:

- tickets
- incidents
- service requests
- problems
- changes
- SLA
- escalation
- knowledge base
- assignment
- technician


# ============================================================
# 43. MAINTENANCE SERVICE
# ============================================================

Manage:

- POS terminals
- printers
- scanners
- servers
- vehicles
- machines
- equipment

Features:

- preventive maintenance
- corrective maintenance
- maintenance plans
- service history
- technician
- spare parts
- warranty


# ============================================================
# 44. LOGISTICS SERVICE
# ============================================================

Support:

- shipment
- carrier
- route
- delivery
- tracking
- proof of delivery
- delivery cost


# ============================================================
# 45. DELIVERY SERVICE
# ============================================================

Support:

- driver
- vehicle
- route
- delivery order
- COD
- delivery fee
- GPS integration
- failed delivery
- return


# ============================================================
# 46. FLEET SERVICE
# ============================================================

Features:

- vehicles
- drivers
- mileage
- fuel
- maintenance
- insurance
- registration
- routes
- expenses


# ============================================================
# 47. CONTRACT SERVICE
# ============================================================

Support:

- contracts
- supplier contracts
- customer contracts
- employee contracts
- renewal
- expiration
- clauses
- obligations
- approval
- attachments
- reminders


# ============================================================
# 48. DOCUMENT SERVICE
# ============================================================

Documents can belong to:

- customer
- supplier
- employee
- invoice
- order
- purchase order
- project
- contract
- asset

Features:

- metadata
- approval
- version
- tags
- permissions
- retention
- archive


# ============================================================
# 49. ENTERPRISE STORAGE SERVICE
# ============================================================

Use:

MinIO / S3-compatible storage.

Store:

- documents
- invoices
- receipts
- images
- reports
- attachments
- exports
- backups

Features:

- upload
- download
- stream
- multipart upload
- resumable upload
- versioning
- checksum
- quotas
- lifecycle
- archive
- retention


# ============================================================
# 50. SEARCH SERVICE
# ============================================================

Search:

- customers
- products
- orders
- invoices
- files
- documents
- transactions
- users

Initially use PostgreSQL search.

Prepare OpenSearch extraction.

Search must obey permissions.


# ============================================================
# 51. WORKFLOW SERVICE
# ============================================================

Reusable workflow engine.

Features:

- approval
- rejection
- delegation
- escalation
- timeout
- SLA
- sequential approval
- parallel approval
- conditions
- comments
- attachments

Example:

Purchase
-> Manager
-> Finance
-> Procurement


# ============================================================
# 52. AUTOMATION SERVICE
# ============================================================

Visual automation:

TRIGGER
-> CONDITION
-> ACTION

Examples:

stock low
-> create purchase request

invoice overdue
-> notify customer

product expiring
-> notify manager

sales target reached
-> notify Telegram


# ============================================================
# 53. NOTIFICATION SERVICE
# ============================================================

Channels:

- in-app
- email
- Telegram
- SMS
- push
- webhook

Features:

- templates
- localization
- scheduling
- preferences
- retry
- delivery tracking


# ============================================================
# 54. TELEGRAM SERVICE
# ============================================================

Telegram Mini App:

- login
- dashboard
- products
- orders
- invoices
- receipts
- payments
- loyalty
- support
- profile

Telegram Bot:

- sales report
- stock report
- pending approval
- alerts
- order status
- operational commands

Examples:

/sales
/report
/stock
/orders
/approve


# ============================================================
# 55. MOBILE SERVICE
# ============================================================

Flutter client.

Roles:

Customer
Staff
Manager
Warehouse
Driver
Partner

Customer:

- orders
- payments
- invoices
- loyalty
- support

Staff:

- tasks
- customers
- inventory
- orders
- approvals

Manager:

- KPIs
- reports
- approvals
- alerts
- branch monitoring

Warehouse:

- receiving
- picking
- transfer
- stock count
- barcode


# ============================================================
# 56. CUSTOMER PORTAL
# ============================================================

Features:

- account
- profile
- orders
- receipts
- invoices
- payment
- loyalty
- subscriptions
- documents
- support
- notifications


# ============================================================
# 57. PARTNER PORTAL
# ============================================================

Partners can manage:

- company
- users
- applications
- API keys
- OAuth
- webhooks
- events
- API usage
- orders
- invoices
- documents


# ============================================================
# 58. API MANAGEMENT SERVICE
# ============================================================

Public APIs:

/api/v1/products
/api/v1/customers
/api/v1/orders
/api/v1/inventory
/api/v1/payments
/api/v1/invoices
/api/v1/reports
/api/v1/storage

Support:

- API keys
- OAuth2
- OIDC
- scopes
- rate limits
- quotas
- API usage
- audit
- API versions


# ============================================================
# 59. DEVELOPER PORTAL
# ============================================================

Features:

- application registration
- credentials
- OAuth apps
- API docs
- API explorer
- webhooks
- event subscriptions
- sandbox
- production
- usage
- logs
- changelog

Developer flow:

Register
-> Select APIs
-> Request Access
-> Approval
-> Credentials
-> Sandbox
-> Production


# ============================================================
# 60. WEBHOOK SERVICE
# ============================================================

Events:

order.created
order.paid
order.cancelled
payment.completed
payment.failed
inventory.updated
customer.created
invoice.created
refund.completed

Support:

- signatures
- retries
- delivery log
- replay
- disable
- filtering


# ============================================================
# 61. INTEGRATION SERVICE
# ============================================================

Central integration hub.

Support:

- REST
- GraphQL
- webhooks
- OAuth
- SFTP
- CSV
- Excel
- email
- Telegram
- SMS
- payment
- bank
- accounting
- delivery
- marketplace
- BI

Use adapter architecture.

Do not tightly couple to one provider.


# ============================================================
# 62. PARTNER MANAGEMENT SERVICE
# ============================================================

Partner types:

- bank
- supplier
- distributor
- payment provider
- marketplace
- delivery company
- technology provider
- corporate partner

Features:

- partner profile
- contract
- applications
- API access
- permissions
- quotas
- status
- settlement


# ============================================================
# 63. MARKETPLACE SERVICE
# ============================================================

Support multiple sellers.

Features:

- seller registration
- seller catalog
- commission
- seller orders
- payout
- settlement
- seller rating
- returns


# ============================================================
# 64. FRANCHISE SERVICE
# ============================================================

Hierarchy:

Franchise Group
-> Company
-> Branch
-> Store

Central control:

- product
- brand
- pricing
- promotions
- policies
- reports

Local control:

- staff
- daily operations
- stock
- POS


# ============================================================
# 65. REPORTING SERVICE
# ============================================================

Reports:

- sales
- POS
- inventory
- procurement
- finance
- accounting
- customers
- CRM
- HR
- warehouse
- suppliers
- branches
- audit

Features:

- filters
- grouping
- drilldown
- saved reports
- scheduling
- Excel
- CSV
- PDF
- API


# ============================================================
# 66. ANALYTICS SERVICE
# ============================================================

KPIs:

- revenue
- gross profit
- net profit
- transactions
- average basket
- customer growth
- inventory turnover
- stockout rate
- branch performance
- supplier performance
- employee performance

Support:

- daily
- weekly
- monthly
- yearly
- YoY
- MoM
- forecast
- variance


# ============================================================
# 67. DATA PLATFORM
# ============================================================

Do not run huge analytical queries directly against POS
transaction tables.

Architecture:

Operational DB
-> Events / ETL
-> Analytics storage
-> BI
-> AI


# ============================================================
# 68. AI PLATFORM
# ============================================================

Create an AI gateway.

Components:

- AI gateway
- model provider abstraction
- prompt management
- tool registry
- permissions
- AI audit
- usage/cost tracking
- evaluation

AI providers must be replaceable.


# ============================================================
# 69. AI ASSISTANT
# ============================================================

Users can ask:

"Show today's sales."

"Which drinks sell best?"

"What products will run out tomorrow?"

"Show overdue invoices."

"Why did Branch 3 sales drop?"

"Create a purchase request."

"Summarize this contract."

"Show profit by product."


# ============================================================
# 70. AI AGENTS
# ============================================================

Prepare:

Sales Agent
Finance Agent
Inventory Agent
Procurement Agent
Customer Support Agent
Reporting Agent
Operations Agent

Example:

Inventory Agent
-> detect low stock
-> analyze demand
-> recommend quantity
-> prepare purchase request
-> require human approval
-> create order


# ============================================================
# 71. AUTOMATION + AI TOOL SECURITY
# ============================================================

AI and automation must NOT bypass:

- RBAC
- tenant isolation
- approval rules
- business rules
- audit

Sensitive actions require human approval.

Examples:

- payment
- refund
- deletion
- large purchase
- permission change
- financial posting


# ============================================================
# 72. SECURITY CENTER
# ============================================================

Show:

- active sessions
- failed logins
- suspicious activity
- privileged actions
- permission changes
- API abuse
- security alerts
- devices

Admin actions:

- revoke session
- revoke device
- disable account
- disable API key
- rotate credential


# ============================================================
# 73. AUDIT SERVICE
# ============================================================

Audit:

- login
- logout
- sale
- refund
- payment
- invoice
- approval
- file download
- data export
- configuration change
- permission change
- API access
- AI action
- automation action

Record:

WHO
WHAT
WHEN
WHERE
IP
DEVICE
SERVICE
RESOURCE
OLD VALUE
NEW VALUE
RESULT
REQUEST ID


# ============================================================
# 74. CONFIGURATION SERVICE
# ============================================================

Configurable:

- business hours
- tax
- currency
- payments
- POS
- inventory
- promotions
- approvals
- notifications
- storage
- retention
- integrations

Never hard-code business configuration.


# ============================================================
# 75. FEATURE FLAG SERVICE
# ============================================================

Flags:

- offline_pos
- telegram_mini_app
- mobile_app
- loyalty
- advanced_inventory
- workflow
- automation
- AI
- marketplace

Target by:

- environment
- organization
- company
- branch
- role
- user
- device
- application


# ============================================================
# 76. LOCALIZATION SERVICE
# ============================================================

Support:

- English
- Khmer
- Thai
- Chinese
- Vietnamese

All UI text must use translation keys.


# ============================================================
# 77. CURRENCY SERVICE
# ============================================================

Support:

USD
KHR
THB
CNY
EUR

Features:

- exchange rates
- transaction currency
- reporting currency
- currency precision
- FX calculation


# ============================================================
# 78. SUBSCRIPTION SERVICE
# ============================================================

Support:

- monthly
- quarterly
- yearly
- usage-based
- membership
- service plan

Features:

- renewal
- pause
- cancel
- upgrade
- downgrade
- billing
- retry
- grace period


# ============================================================
# 79. LOYALTY SERVICE
# ============================================================

Features:

- points
- rewards
- tiers
- cashback
- membership
- referral
- birthday reward
- coupons

Tiers:

Bronze
Silver
Gold
Platinum
VIP


# ============================================================
# 80. QUALITY SERVICE
# ============================================================

Support:

- inspection
- quality check
- rejected stock
- defective product
- quarantine
- batch release
- supplier quality
- return to supplier


# ============================================================
# 81. MANUFACTURING SERVICE
# ============================================================

Prepare for:

- BOM
- production order
- work center
- routing
- raw materials
- finished goods
- by-products
- waste
- production cost
- quality check

Businesses that do not need manufacturing can disable it.


# ============================================================
# 82. BUSINESS RULE ENGINE
# ============================================================

Create configurable rules.

Example:

IF invoice > 10,000
THEN Finance Manager approval.

IF refund > 500
THEN Supervisor approval.

IF stock < reorder point
THEN create purchase suggestion.

Rules should be versioned and audited.


# ============================================================
# 83. JOB SERVICE
# ============================================================

Enterprise job center.

Statuses:

PENDING
RUNNING
COMPLETED
FAILED
RETRYING
CANCELLED

Jobs:

- report
- export
- import
- notification
- sync
- file processing
- AI
- automation


# ============================================================
# 84. SEARCH / GLOBAL SEARCH
# ============================================================

Create one global search.

Example:

Search:
ABC Company

Results:

- customer
- orders
- invoices
- contracts
- payments
- documents
- tickets

Permissions must be checked for every result.


# ============================================================
# 85. IMPORT SERVICE
# ============================================================

Support:

- CSV
- Excel
- JSON

Features:

- upload
- mapping
- validation
- preview
- error report
- import
- rollback where applicable
- history

Example:

Import Products
-> map columns
-> validate
-> preview
-> confirm
-> process
-> report


# ============================================================
# 86. EXPORT SERVICE
# ============================================================

Support:

- CSV
- Excel
- PDF
- JSON

Large exports must run through BullMQ.

Request
-> Job
-> Generate
-> Store in MinIO
-> Notify
-> Download


# ============================================================
# 87. ADMIN DASHBOARD
# ============================================================

Executive dashboard:

- revenue
- sales
- profit
- orders
- inventory
- low stock
- pending approval
- unpaid invoice
- branch performance
- system alerts
- service health
- storage usage

Allow customizable widgets by role.


# ============================================================
# 88. ENTERPRISE ADMIN NAVIGATION
# ============================================================

EXECUTIVE
- Dashboard
- KPI
- Analytics
- Alerts

BUSINESS
- Sales
- Customers
- Products
- Inventory
- Warehouse
- Procurement
- Finance
- Accounting

PEOPLE
- Employees
- Users
- Roles
- Organization

OPERATIONS
- POS
- Logistics
- Delivery
- Maintenance

CUSTOMER
- CRM
- Loyalty
- Marketing
- Support

PLATFORM
- Storage
- Documents
- Workflow
- Automation
- Notifications
- Search

INTEGRATION
- Partners
- APIs
- Webhooks
- Developer Portal

INTELLIGENCE
- AI
- Agents
- Forecasting
- Analytics

SECURITY
- Audit
- Sessions
- Devices
- Policies

SYSTEM
- Configuration
- Feature Flags
- Jobs
- Health
- Logs
- Backups


# ============================================================
# 89. WEB APPLICATION
# ============================================================

Customer UI:

- home
- catalog
- cart
- checkout
- orders
- payment
- invoices
- loyalty
- profile
- support

Staff UI:

- dashboard
- customers
- tasks
- sales
- inventory
- approvals

Manager UI:

- KPIs
- reports
- alerts
- branch
- staff
- approvals


# ============================================================
# 90. POS UI
# ============================================================

Fast interface.

Requirements:

- keyboard-friendly
- barcode-first
- touch-friendly
- large product buttons
- customer lookup
- payment screen
- receipt
- shift
- cash drawer
- offline indicator
- sync indicator

Restaurant POS requires table-based UI.

Fuel POS requires dispenser/pump UI.


# ============================================================
# 91. MOBILE UI
# ============================================================

Use role-based navigation.

Provide:

- bottom navigation
- push notifications
- offline indicator
- barcode scanning
- camera
- deep links
- biometric authentication where appropriate


# ============================================================
# 92. TELEGRAM MINI APP UI
# ============================================================

Keep it lightweight.

Screens:

- Home
- Products
- Orders
- Invoice
- Loyalty
- Support
- Profile

Use same APIs and permissions.


# ============================================================
# 93. API VERSIONING
# ============================================================

Use:

/api/v1
/api/v2

Never break partner integrations unexpectedly.

Provide:

- changelog
- migration guide
- deprecation notice
- compatibility period


# ============================================================
# 94. OBSERVABILITY
# ============================================================

Every service must expose:

/health
/ready
/metrics

Track:

- latency
- errors
- throughput
- database
- Redis
- queue
- storage
- webhook
- POS synchronization

Use trace/correlation IDs.


# ============================================================
# 95. RESILIENCE
# ============================================================

Support:

- timeout
- retry
- exponential backoff
- idempotency
- circuit breaker
- fallback
- dead letter
- graceful degradation

External integrations must fail without bringing down the entire platform.


# ============================================================
# 96. DATABASE ARCHITECTURE
# ============================================================

Start with PostgreSQL.

Organize data by bounded domain.

Possible schemas/modules:

identity
organization
product
customer
sales
order
inventory
warehouse
procurement
finance
crm
hr
workflow
audit
integration

Do not allow one business module to directly modify
another module's tables.

Use APIs/events.


# ============================================================
# 97. CACHE STRATEGY
# ============================================================

Redis for:

- caching
- rate limits
- temporary sessions
- locks
- job queues
- temporary upload sessions

Redis is not permanent business storage.


# ============================================================
# 98. OBJECT STORAGE
# ============================================================

MinIO locally.

S3-compatible abstraction.

Structure:

/tenant/company/year/month/entity/

Never expose raw physical storage path.

Use signed URLs where appropriate.


# ============================================================
# 99. MONOREPO
# ============================================================

enterprise-platform/

apps/
  web/
  admin/
  pos/
  mobile/
  telegram-mini-app/

services/
  backend/

packages/
  ui/
  types/
  api-client/
  validation/
  auth/
  config/
  business-rules/

infrastructure/
  postgres/
  redis/
  minio/
  monitoring/
  reverse-proxy/

docs/
tests/
scripts/

Use pnpm + Turborepo.


# ============================================================
# 100. BACKEND MODULE STRUCTURE
# ============================================================

services/backend/src/

modules/
  identity/
  organizations/
  users/
  roles/
  master-data/
  products/
  pricing/
  promotions/
  customers/
  crm/
  sales/
  orders/
  pos/
  restaurant/
  beverage/
  fuel/
  pharmacy/
  inventory/
  warehouse/
  procurement/
  suppliers/
  payments/
  finance/
  accounting/
  tax/
  budgeting/
  assets/
  expenses/
  hr/
  projects/
  service-management/
  maintenance/
  logistics/
  delivery/
  fleet/
  contracts/
  documents/
  storage/
  search/
  workflow/
  automation/
  notifications/
  reporting/
  analytics/
  integrations/
  partners/
  developer/
  subscriptions/
  loyalty/
  manufacturing/
  quality/
  audit/
  configuration/
  feature-flags/
  jobs/
  ai/

common/
  auth/
  guards/
  validation/
  errors/
  logging/
  tracing/

infrastructure/
  database/
  redis/
  storage/
  queue/
  events/
  email/


# ============================================================
# 101. SERVICE DESIGN RULE
# ============================================================

Every major service should define:

1. Domain entities
2. Database tables
3. Business rules
4. APIs
5. Permissions
6. Events
7. Notifications
8. Background jobs
9. Audit events
10. Reports
11. UI screens
12. Integration points
13. Tests

Do not create empty services just for appearance.


# ============================================================
# 102. API RULE
# ============================================================

Each API must define:

- request DTO
- response DTO
- validation
- authorization
- tenant check
- audit
- OpenAPI documentation
- consistent errors
- request ID


# ============================================================
# 103. SECURITY RULE
# ============================================================

Never trust frontend values for:

- price
- discount
- tax
- total
- permissions
- tenant
- role
- stock
- payment status

Recalculate and validate server-side.


# ============================================================
# 104. TENANT ISOLATION
# ============================================================

Every business resource must be scoped appropriately.

No:

Tenant A
-> Tenant B data

must ever be possible.

Test cross-tenant access explicitly.


# ============================================================
# 105. AUDIT RULE
# ============================================================

Critical business changes must create audit entries.

Examples:

- price change
- refund
- payment
- permission change
- inventory adjustment
- configuration change
- data export
- AI action


# ============================================================
# 106. PAYMENT RULE
# ============================================================

Payment processing must be isolated behind provider interfaces.

Never put provider-specific code throughout the business modules.

Example:

Payment Service
|
+-- Provider A
+-- Provider B
+-- Bank
+-- QR
+-- Wallet


# ============================================================
# 107. INTEGRATION RULE
# ============================================================

External providers must use adapters.

Example:

PaymentProvider
StorageProvider
EmailProvider
SMSProvider
ShippingProvider
AccountingProvider
BankProvider

Business services must depend on interfaces, not vendors.


# ============================================================
# 108. MICROSERVICE MIGRATION STRATEGY
# ============================================================

Start as a modular monolith if the project is new.

Do NOT create dozens of deployment units immediately.

Extract a module into a microservice when it has:

- independent scaling
- independent deployment
- strong domain boundary
- large workload
- separate failure requirements

Possible future extraction:

storage-service
notification-service
reporting-service
integration-service
search-service
payment-service


# ============================================================
# 109. EVENTS
# ============================================================

Define domain events.

Examples:

USER_CREATED
CUSTOMER_CREATED
PRODUCT_CREATED

SALE_CREATED
SALE_COMPLETED
REFUND_CREATED

ORDER_CREATED
ORDER_PAID
ORDER_CANCELLED

STOCK_CHANGED
STOCK_LOW
STOCK_EXPIRED

PURCHASE_CREATED
PURCHASE_APPROVED

INVOICE_CREATED
PAYMENT_RECEIVED

FILE_UPLOADED

WORKFLOW_STARTED
WORKFLOW_APPROVED

TICKET_CREATED


# ============================================================
# 110. EVENT RULE
# ============================================================

Events should be:

- versioned
- traceable
- retryable
- idempotent
- documented

Do not use events for everything.

Use synchronous APIs when immediate consistency is required.


# ============================================================
# 111. TESTING
# ============================================================

Implement:

Unit Tests
Integration Tests
API Tests
E2E Tests
Security Tests
Load Tests
Permission Tests
Tenant Isolation Tests
POS Offline Tests
Sync Tests
Payment Tests
Workflow Tests
Backup/Restore Tests

Critical business logic must have automated tests.


# ============================================================
# 112. DEMO INDUSTRY CONFIGURATIONS
# ============================================================

Create sample organizations.

CAFE:

Products
Recipes
Modifiers
POS
Inventory
Customers
Loyalty
Payments
Reports

RESTAURANT:

Products
Recipes
Tables
Kitchen
POS
Inventory
Delivery

FUEL STATION:

Fuel
Pumps
Tanks
POS
Shift
Reconciliation

ELECTRONICS:

Products
Serial
IMEI
Warranty
Repair
POS
Inventory

SUPERMARKET:

Products
Barcode
Weighted Products
Promotions
Loyalty
POS
Inventory

WHOLESALE:

Customers
Credit
Price Lists
Orders
Warehouse
Procurement
Invoices

Each is configuration, not a separate backend.


# ============================================================
# 113. IMPLEMENTATION ORDER
# ============================================================

PHASE 1
Platform Foundation

- monorepo
- Next.js
- NestJS
- Prisma
- PostgreSQL
- Redis
- Docker
- authentication
- organization
- RBAC
- audit
- configuration

PHASE 2
Core Business

- master data
- product
- pricing
- customer
- sales
- orders
- POS
- inventory
- warehouse
- payment

PHASE 3
Enterprise

- procurement
- finance
- accounting
- CRM
- HR
- workflow
- documents
- storage
- reporting
- notification

PHASE 4
Channels

- mobile
- Telegram Mini App
- Telegram Bot
- customer portal
- partner portal
- developer portal

PHASE 5
Advanced

- automation
- analytics
- search
- AI
- AI agents
- integrations
- marketplace

PHASE 6
Scale

- Kafka where needed
- Temporal where needed
- OpenSearch where needed
- service extraction
- Kubernetes where needed


# ============================================================
# 114. DEVELOPMENT BEHAVIOR
# ============================================================

Before implementing:

1. Inspect current repository.
2. Identify existing features.
3. Identify existing database.
4. Identify existing APIs.
5. Identify existing authentication.
6. Identify existing POS.
7. Identify existing integrations.
8. Identify reusable code.

Never rewrite working functionality blindly.

For each feature:

ANALYZE
-> DESIGN
-> IMPLEMENT
-> MIGRATE
-> TEST
-> DOCUMENT


# ============================================================
# 115. DEFINITION OF DONE
# ============================================================

A feature is NOT complete when the API works.

A feature is complete when:

- backend implemented
- database migration implemented
- permissions implemented
- validation implemented
- audit implemented
- events implemented where required
- notifications implemented where required
- API documented
- frontend implemented
- mobile behavior defined where required
- POS behavior defined where required
- Telegram behavior defined where required
- integration behavior defined where required
- tests implemented
- error handling implemented
- monitoring implemented
- documentation updated


# ============================================================
# 116. FINAL PRODUCT
# ============================================================

Build a Universal Enterprise Business Platform:

                    ONE PLATFORM
                         |
      +------------------+------------------+
      |                  |                  |
     WEB                POS               MOBILE
      |                  |                  |
      +------------------+------------------+
                         |
                    TELEGRAM
                         |
                    API PLATFORM
                         |
              ENTERPRISE BUSINESS CORE
                         |
     +-------------------+-------------------+
     |                   |                   |
    ERP                 CRM                 POS
     |                   |                   |
 Finance             Customers            Sales
 Inventory           Marketing            Orders
 Procurement         Support             Payments
 HR                  Loyalty             Refunds
 Warehouse                               
                         |
              PLATFORM SERVICES
                         |
      +--------+--------+--------+---------+
      |        |        |        |         |
   Storage  Workflow  Audit   Search   Automation
      |        |        |        |         |
      +--------+--------+--------+---------+
                         |
                    AI PLATFORM
                         |
                 PARTNER ECOSYSTEM
                         |
          APIs / OAuth / Webhooks / Events
                         |
                  EXTERNAL SYSTEMS

The platform must be able to grow from:

ONE STORE
-> MULTIPLE STORES
-> RETAIL CHAIN
-> RESTAURANT GROUP
-> FUEL NETWORK
-> WHOLESALE COMPANY
-> MULTI-COMPANY ENTERPRISE
-> MULTI-COUNTRY ENTERPRISE

The architecture must be:

- modular
- secure
- scalable
- configurable
- auditable
- observable
- API-first
- mobile-ready
- POS-ready
- offline-capable
- partner-ready
- AI-ready
- automation-ready
- integration-ready

DO NOT build isolated features.

Every capability must fit into the common enterprise platform.

DO NOT implement every future module immediately.

First establish reusable platform patterns, then implement modules progressively.

The final system must be capable of supporting new industries,
new applications, new partners and new business processes
without requiring a complete rewrite.
