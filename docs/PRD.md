# Freelancer Stability Network — Source PRD

Extracted from the supplied PDF. Page markers preserve source order.

Page 1
FREELANCER
STABILITY NETWORK
Product Requirements Document (PRD)
Secure Full-Stack Marketplace MVP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project Freelancer Stability Network
Team Ali Taleb & Harshvardhan Kirtisinh Rahevar
Course Context Software Engineering / DevSecOps Project
MVP Duration 5 Weeks
Version 1.0
Prepared for academic project planning and implementation

Page 2
Document Overview
This PRD defines the product vision, MVP scope, functional and non-functional requirements, 
architecture, security requirements, DevSecOps controls, testing strategy, and delivery plan for the 
Freelancer Stability Network.
Section Purpose
1-4 Vision, problem, goals, and target users
5-7 MVP scope and product requirements
8-12 Quality, security, DevSecOps, and container controls
13-16 Architecture, technology stack, API, and data model
17-19 Risks, testing, and success criteria
20-22 Five-week plan, future scope, and final vision
1. Product Overview
The Freelancer Stability Network is a peer-to-peer freelance marketplace designed to connect 
clients with freelancers while keeping platform fees lower than traditional freelance platforms. The 
system allows users to create profiles, post jobs, discover relevant opportunities, communicate 
directly, manage payments, and build reputation through ratings and reviews.
The MVP will be developed over five weeks and will apply software engineering, DevOps, and 
DevSecOps principles throughout the development lifecycle.
2. Problem Statement
Professionals affected by layoffs or unstable employment may turn to freelance work for income. 
Existing platforms such as Upwork and Fiverr provide access to freelance opportunities but may 
charge significant platform fees. The Freelancer Stability Network aims to provide a simpler and 
leaner marketplace where freelancers and clients can connect directly, communicate, complete 
projects, and build trust.
3. Product Goals
 Allow freelancers and clients to create accounts and profiles.
 Allow clients to create and manage job postings.
 Allow freelancers to search and discover relevant jobs.
 Provide basic matching between jobs and freelancers.
 Allow clients and freelancers to communicate securely.

Page 3
 Support payments through Stripe Connect.
 Allow users to rate each other after completed work.
 Provide a secure and reliable application using DevSecOps practices.
4. Non-Goals
 Advanced AI-based recommendation systems
 Video or voice calling
 Complex project-management tools
 International tax management
 Cryptocurrency payments
 Advanced dispute arbitration
 Native mobile applications
 Enterprise-scale infrastructure
5. Target Users
Freelancer
 Create a professional profile.
 List skills and experience.
 Search for available jobs.
 Receive relevant job recommendations.
 Communicate with clients.
 Receive payments.
 Build reputation through reviews.
Client
 Create a client profile.
 Post freelance jobs.
 Find suitable freelancers.
 Communicate with freelancers.
 Pay freelancers.
 Rate freelancers after project completion.
Administrator
Administrator functionality will remain minimal in the MVP. Administrators may monitor users 
and job postings, handle inappropriate content, review suspicious activity, and manage reported 
accounts.
6. MVP Scope
Week 1 - Marketplace Foundation
 User registration
 User login and logout

Page 4
 Freelancer and client roles
 User profiles
 Freelancer skills
 Client job postings
 Job browsing
Example: a client posts a React/Node.js/MongoDB job while a freelancer lists React, JavaScript, 
Node.js, Express, and MongoDB skills.
Week 2 - Job Matching
The application will provide a simple matching algorithm that compares job-required skills with 
freelancer-listed skills and returns a match score. Advanced machine learning is not required for 
the MVP.
Job Skills: React, Node.js, MongoDB
Freelancer Skills: React, Node.js, Python
Matches: 2 / 3 skills
Match Score: 67%
Weeks 3-5
Week Feature Security Focus
3 Private messaging Conversation authorization and privacy
4 Stripe Connect payments Secret protection and server-side validation
5 Ratings/reviews Eligibility checks and abuse prevention
7. Functional Requirements
FR-01 - User Registration
The system shall allow users to create an account using a name, email, password, and account 
type (Freelancer or Client).
FR-02 - Authentication
The system shall allow registered users to log in, log out, and maintain an authenticated session. 
Passwords shall never be stored as plaintext.

Page 5
FR-03 - User Profiles
Freelancers shall be able to create profiles containing a name, biography, skills, experience, and 
portfolio information. Clients shall be able to create profiles containing a name, organization, 
and description.
FR-04 - Job Posting
Clients shall be able to create, edit, delete, and view their job postings and applicants. A job 
posting shall contain a title, description, required skills, budget, and status.
FR-05 - Job Browsing
Freelancers shall be able to browse available jobs and may filter them by skills, category, or 
budget.
FR-06 - Job Matching
The system shall compare job requirements with freelancer skills and generate a match score 
based on matching skills.
FR-07 - Messaging
Clients and freelancers shall be able to exchange private messages. Only users participating in 
the conversation shall be able to access those messages.
FR-08 - Payments
The application shall integrate with Stripe Connect to create payments, track payment status, and 
associate payments with jobs. The application shall not directly store credit-card information.
FR-09 - Ratings and Reviews
After a project is completed, clients shall be able to rate freelancers and freelancers shall be able 
to rate clients. Only users who participated in the job shall be allowed to submit a review.
FR-10 - Authorization
Users shall only be allowed to modify resources they own. A client shall not edit another client's 
job, a freelancer shall not modify another freelancer's profile, and users shall not access 
conversations they do not participate in.
8. Non-Functional Requirements
NFR-01 - Security
The application shall use password hashing, authentication, role-based authorization, server-side 
input validation, secrets management, dependency scanning, and secure API design.
NFR-02 - Performance
Typical application requests should respond within approximately three seconds under normal 
MVP usage.

Page 6
NFR-03 - Availability
The deployed application should remain available during normal testing and demonstration 
periods.
NFR-04 - Usability
The interface should be simple and understandable for users with basic web experience.
NFR-05 - Maintainability
The application should use modular components and clear separation between frontend, 
backend, database, and external services.
NFR-06 - Portability
The application should be containerized so development and deployment environments remain 
consistent.
NFR-07 - Privacy
Passwords, messages, payment information, and authentication tokens must not be exposed to 
unauthorized users.
9. Security Requirements
Authentication
Passwords must be hashed, must never be logged, and must never be stored in plaintext.
Authorization
The backend must validate user ownership and permissions for every protected API request.
Input Validation
User input such as job descriptions, messages, profile information, and ratings must be validated 
before storage or processing.
Secrets Management
Sensitive values must not be committed to Git. They should be injected through environment 
variables or a secure secret-management mechanism.
DATABASE_URL
JWT_SECRET
STRIPE_SECRET_KEY
10. DevSecOps Requirements
Security checks should be incorporated into the CI/CD pipeline rather than performed only at the 
end of development.

Page 7
Developer Push
      |
      v
Source Repository
      |
      v
SAST -> Dependency Scan -> Automated Tests
      |
      v
Docker Build -> Container Scan
      |
      v
Deploy Test Environment -> DAST
      |
      v
Production Deployment
11. Source Code Security
 Protected main branch
 Pull or merge requests
 Code review
 Use of .gitignore
 Secret scanning
 Dependency scanning
 No direct pushes to the production branch
12. Container Security
 Run with the minimum required privileges.
 Avoid privileged mode.
 Avoid unnecessary Linux capabilities.
 Use trusted base images.
 Keep images small.
 Run processes as non-root where possible.
 Scan images for known vulnerabilities.
 Keep development and production environments separated.
13. Proposed Architecture
                 User Browser
                      |
                      v
             React / Next.js
                      |
                      v
              Backend REST API
                Node / Express
              /       |       \
             /        |        \

Page 8
          Auth       Jobs     Messaging
             \        |        /
              \       |       /
                  Database
                     |
              PostgreSQL/MongoDB
                     |
                     v
                Stripe Connect
14. Suggested Technology Stack
Layer Suggested Technology
Frontend React or Next.js; JavaScript/TypeScript; HTML/CSS
Backend Node.js + Express
Database PostgreSQL or MongoDB
Authentication JWT or secure server-side sessions; bcrypt or equivalent
Payments Stripe Connect
Infrastructure Docker, GitHub/GitLab, CI/CD pipeline, cloud hosting
15. API Examples
POST   /api/auth/register
POST   /api/auth/login
GET    /api/users/:id
PUT    /api/users/:id
POST   /api/jobs
GET    /api/jobs
GET    /api/jobs/:id
PUT    /api/jobs/:id
DELETE /api/jobs/:id
GET    /api/jobs/:id/matches
POST   /api/messages
GET    /api/conversations/:id
POST   /api/payments
GET    /api/payments/:id

Page 9
POST   /api/reviews
GET    /api/users/:id/reviews
16. Core Data Models
Model Key Fields
User id, name, email, passwordHash, role, bio, skills, rating, createdAt
Job id, clientId, title, description, requiredSkills, budget, status, createdAt
Message id, senderId, receiverId, conversationId, content, timestamp
Review id, jobId, reviewerId, reviewedUserId, rating, comment
Payment id, jobId, clientId, freelancerId, amount, stripePaymentId, status
17. Major Security Risks
Broken Access Control
A user attempts to access another user's messages or resources. The backend must verify 
authorization instead of trusting a requested object ID.
Injection
Database queries and user input must be handled safely and validated server-side.
Credential Exposure
API keys, Stripe credentials, database passwords, and JWT secrets must never appear in source 
code or logs.
Vulnerable Dependencies
Third-party packages and container images should be checked for known vulnerabilities.
Payment Abuse
Payment actions must be validated server-side and tied to legitimate jobs and users.
Fake Reviews
Only users associated with a completed job may create reviews for that job.

Page 10
18. Testing Strategy
Unit Testing: Test individual functions such as calculateMatchScore().
Integration Testing: Test interactions between the API and database, authentication and protected 
routes, and the payment service and backend.
SAST: Analyze application source code for security weaknesses.
DAST: Test the deployed application for security weaknesses.
Dependency Scanning: Scan third-party libraries for known vulnerabilities.
Container Scanning: Scan Docker images for known vulnerabilities.
19. Success Criteria
 Users can register and log in.
 Freelancers can create profiles.
 Clients can post jobs.
 Freelancers can browse jobs.
 The matching algorithm produces recommendations.
 Clients and freelancers can exchange messages.
 Stripe payment integration functions in test mode.
 Completed jobs can receive ratings.
 Unauthorized users cannot access protected data.
 The application can be deployed using containers and CI/CD.
20. Five-Week Development Plan
Week Primary Deliverable Security / DevSecOps Focus
1 Authentication, profiles, job marketplace Secure auth, input validation, protected branches
2 Job matching algorithm Unit tests, dependency scanning
3 Private messaging Authorization tests, privacy checks
4 Stripe Connect payment integration Secrets management, payment validation
5 Ratings, security testing, deployment SAST, DAST, container scan, final deployment
Security testing and CI/CD should occur throughout all five weeks rather than being added only at 
the end.

Page 11
21. Future Features
 AI-based job matching
 Freelancer recommendations
 Advanced search
 Real-time notifications
 Dispute management
 Milestone-based payments
 Portfolio uploads
 Identity verification
 Two-factor authentication
 Admin dashboard
 Mobile application
22. Final Product Vision
The Freelancer Stability Network aims to demonstrate how a modern freelance marketplace can be 
developed using secure software-engineering practices. The project combines full-stack 
development with secure SDLC, DevOps, DevSecOps, CI/CD, source-code security, container security, 
application security, dependency management, secrets management, authentication, and 
authorization.
The MVP should demonstrate not only that the application works, but that security is considered 
throughout its design, development, testing, and deployment.