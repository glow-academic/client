// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 29,
    "userId": 86,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "idToken": "idToken_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 92,
    "userId": 30,
    "expires": "2025-07-21T02:17:25.640Z"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 98,
    "name": "Admin User",
    "email": "admin@example.com"
  },
  {
    "id": 14,
    "name": "Instructional User",
    "email": "instructional@example.com",
    "emailVerified": "2025-07-21T02:17:25.640Z"
  },
  {
    "id": 66,
    "name": "Instructor User",
    "email": "instructor@example.com",
    "emailVerified": "2025-07-21T02:17:25.640Z"
  },
  {
    "id": 16,
    "name": "TA User",
    "emailVerified": "2025-07-21T02:17:25.640Z"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "d84k32z6-a6ti-u96b-ynbt-v7a74rnhy8",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "lastLogin": "2025-07-21T02:17:25.640Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "role": "admin",
    "defaultProfile": "defaultProfile_1",
    "active": true,
    "userId": 98
  },
  {
    "id": "m0qpkbsr-1dwz-vogl-p5y8-xefl6g2w35",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "userId": 14,
    "lastLogin": "2025-07-21T02:17:25.640Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "role": "instructional",
    "defaultProfile": "defaultProfile_2",
    "active": false
  },
  {
    "id": "30iy5o38-eeyx-1x68-9o1t-7l1j7lzjevx",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "userId": 66,
    "lastLogin": "2025-07-21T02:17:25.640Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "role": "instructor",
    "defaultProfile": "defaultProfile_3",
    "active": false
  },
  {
    "id": "2900n6t3-h6tp-gz5s-ipgt-z3iy4vpvjh",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "userId": 16,
    "lastLogin": "2025-07-21T02:17:25.640Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "role": "ta",
    "defaultProfile": "defaultProfile_4",
    "active": false
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "fge6hqb8-9e7c-7x1s-sixc-2a1ubaefv8k",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// DEPARTMENTS MOCK DATA
export const departments = [
  {
    "id": "0w2jg8cy-3e3p-xjsh-814a-93g0jxds53q",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "departmentCode": "departmentCode_1",
    "name": "Departments 1",
    "description": "Description for departments 1"
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "qwam50u1-xb55-342w-29ac-2uafgwfht8d",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "departmentId": "departmentId_1",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "nasc7e2f-bguo-yfz8-llil-a43c1cylxv",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "departmentId": "departmentId_2",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "pyz9ke9k-4b7x-4owo-cjna-jer2dhqasu",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1"
  }
];

// LOCATIONS MOCK DATA
export const locations = [
  {
    "id": "jbga8e2t-mxss-h1jk-2h5s-v4bx5tvgbo8",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Locations 1",
    "description": "Description for locations 1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "xe1xpac4-0rjn-2w02-wqtt-cy4n2uhjuzl",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "d8svuvxp-5p4t-k48f-e3xo-s4rntilh1a",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 47,
    "passPoints": "passPoints_1"
  },
  {
    "id": "bywr21dv-n274-oyp0-i00d-n32qq31vuce",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 89,
    "passPoints": "passPoints_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "ye1q12vq-u8jn-m0hj-qcp4-axmj99ck37",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 60,
    "passPoints": "passPoints_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "9rkumjw6-f14t-nzp6-hfwu-p01npbwydfl",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 36
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 96,
    "level": "level_1",
    "message": "message_1"
  }
];

// APPFEEDBACK MOCK DATA
export const appFeedback = [
  {
    "id": 13,
    "createdAt": "2025-07-21T02:17:25.640Z",
    "profileId": "profileId_1",
    "type": "feature"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "0c9wnvp0-w2ob-85xl-jra7-exk9xz5xm9d",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "gprt52g0-cht5-2iqz-br93-77ota7lfb83",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "completedAt": "2025-07-21T02:17:25.640Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1"
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "uo1fggo7-6zvd-287g-ap04-611sr06fdvm",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "completedAt": "2025-07-21T02:17:25.640Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1"
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "ctei8yu4-mule-69l7-9vu0-18rh3wavhuej",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "kvn46n2e-9eqd-wxwn-q8ju-3hscbms5gpw",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "profileId": "profileId_1",
    "headerComponentIds": [
      "headerComponentIds_1"
    ],
    "primaryComponentIds": [
      "primaryComponentIds_1"
    ],
    "secondaryComponentIds": [
      "secondaryComponentIds_1"
    ],
    "footerComponentIds": [
      "footerComponentIds_1"
    ],
    "autoScroll": "autoScroll_1",
    "showIndicators": "showIndicators_1",
    "headerComponents": "headerComponents_1",
    "mainSplit": "mainSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "f4n269je-7n2f-mi0l-81dw-ccm12aeoqj",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.81,
    "defaultAgent": "defaultAgent_1",
    "color": "color_1"
  },
  {
    "id": "ejuvexsn-ksts-qnhg-eo12-zjpsmoizdb",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.04,
    "defaultAgent": "defaultAgent_2",
    "color": "color_2"
  }
];

// SYSTEMAGENTS MOCK DATA
export const systemAgents = [
  {
    "id": "fwlfwcrt-ma9u-mkbb-a3f0-exm1cq6ugo",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "System_agents 1",
    "description": "Description for system_agents 1",
    "systemPrompt": "systemPrompt_1",
    "temperature": 0.13
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "rynqomo3-6wpn-662l-o6vp-gpv2jr96945",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 6,
    "intensity": 50,
    "locationId": "locationId_1",
    "deadlineId": "deadlineId_1",
    "timeId": "timeId_1",
    "documentIds": [
      "documentIds_1"
    ],
    "defaultScenario": "defaultScenario_1",
    "practiceScenario": "practiceScenario_1",
    "generated": false
  },
  {
    "id": "98fvvvs2-rn65-jio6-q050-9imq4etn859",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "classId": "classId_2",
    "crowdedness": 42,
    "locationId": "locationId_2",
    "deadlineId": "deadlineId_2",
    "timeId": "timeId_2",
    "documentIds": [
      "documentIds_2"
    ],
    "defaultScenario": "defaultScenario_2",
    "practiceScenario": "practiceScenario_2",
    "generated": true
  }
];

// SCENARIODEADLINES MOCK DATA
export const scenarioDeadlines = [
  {
    "id": "8op99css-tox1-9vtc-isqu-2xuc2x9jufq",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "deadline": "deadline_1"
  }
];

// SCENARIOTIMES MOCK DATA
export const scenarioTimes = [
  {
    "id": "q8gdkjqd-tmbo-j6om-1lhn-riv40w4nsea",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "timeOfDay": "timeOfDay_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "2l1f638i-l6y5-cikv-e0fu-wpwl53h21fk",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "d84k32z6-a6ti-u96b-ynbt-v7a74rnhy8",
      "m0qpkbsr-1dwz-vogl-p5y8-xefl6g2w35",
      "30iy5o38-eeyx-1x68-9o1t-7l1j7lzjevx",
      "2900n6t3-h6tp-gz5s-ipgt-z3iy4vpvjh"
    ],
    "defaultCohort": "defaultCohort_1"
  },
  {
    "id": "3xj8r3fi-08h0-9sai-pmuq-1apmh4uduts",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "d84k32z6-a6ti-u96b-ynbt-v7a74rnhy8",
      "m0qpkbsr-1dwz-vogl-p5y8-xefl6g2w35",
      "30iy5o38-eeyx-1x68-9o1t-7l1j7lzjevx",
      "2900n6t3-h6tp-gz5s-ipgt-z3iy4vpvjh"
    ],
    "defaultCohort": "defaultCohort_2"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "ps25by0u-braw-tb2d-dick-fylro13u147",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "title": "Math Practice Simulation",
    "timeLimit": "timeLimit_1",
    "active": true,
    "scenarioIds": [
      "rynqomo3-6wpn-662l-o6vp-gpv2jr96945",
      "98fvvvs2-rn65-jio6-q050-9imq4etn859"
    ],
    "cohortIds": [
      "2l1f638i-l6y5-cikv-e0fu-wpwl53h21fk",
      "3xj8r3fi-08h0-9sai-pmuq-1apmh4uduts"
    ],
    "rubricId": "rubricId_1"
  },
  {
    "id": "w4q9re6s-nvs1-akta-8jdf-ipofbokxofa",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "rynqomo3-6wpn-662l-o6vp-gpv2jr96945",
      "98fvvvs2-rn65-jio6-q050-9imq4etn859"
    ],
    "cohortIds": [
      "2l1f638i-l6y5-cikv-e0fu-wpwl53h21fk",
      "3xj8r3fi-08h0-9sai-pmuq-1apmh4uduts"
    ],
    "rubricId": "rubricId_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "rlhz98mk-gv5x-qzpt-xvkc-7m5qn35qjzd",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "profileId": "profileId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "miv7tbgn-nakf-un4s-x4yr-n0vc3idanef",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "g0t4r8g1-4d72-almg-8wl6-gp2nt47rru5",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "updatedAt": "2025-07-21T02:17:25.640Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "1j24xmq7-hj4o-yk3g-h1rs-wfskha2heyj",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "passed": true,
    "score": 71,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "zx6j3q3y-iebj-66jg-b98o-rm5445knzvs",
    "createdAt": "2025-07-21T02:17:25.640Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 60
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-07-21T02:17:25.640Z"
  }
];

