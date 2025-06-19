// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 87,
    "userId": 14,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 81,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "tokenType": "tokenType_1"
  }
];

// EVALS MOCK DATA
export const evals = [
  {
    "id": "7ctim9g4-7s48-2jzl-pw71-ns8ds5x9vtp",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Math Skills Evaluation",
    "description": "Comprehensive evaluation of mathematical problem-solving abilities",
    "baseAgentId": "baseAgentId_1",
    "scenarioIds": [
      "1md0bd8o-ohpr-w95e-u4ps-3rlznpy9j6k",
      "yfeoo2o2-fkld-x3cq-dfyd-0t9hpp5e9ncb"
    ],
    "agentIds": [
      "pnaojz1b-sf5d-e1ke-lu6f-r6zfgcnow5",
      "iintt0kq-380i-fkwn-ph90-im44stmqwyp"
    ],
    "rubricIds": [
      "nou7xr63-2ql2-cis2-ffbc-br13fpc7gcj",
      "hdyqoh46-iizt-osas-0n4z-qnt1l0xz1dj"
    ],
    "maxTurns": "maxTurns_1",
    "startOnCreation": "startOnCreation_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "yazedy6l-rjjk-8h8v-4ad5-z5pevxtcr9g",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "pco651ye-0q0p-20gj-7sft-zuhdah64lr",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "completedAt": "2025-06-19T01:16:59.431Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": false,
    "traceId": "traceId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 55,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-06-19T01:16:59.431Z"
  }
];

// EVALCHATGRADES MOCK DATA
export const evalChatGrades = [
  {
    "id": "s2i4t6kz-bhn5-k6p8-ihdr-4cif6whoz32",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "passed": false,
    "score": 25,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "evalChatId": "evalChatId_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "5cvb5jgf-yj5j-7rl4-7h0t-gt457esdd3r",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "tspr1wv3-84qm-emoq-5u6b-gf2w8nxr74l"
    ]
  },
  {
    "id": "vfjyb03z-stgn-elgc-bw0g-xq2f7isot38",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "title": "Spring 2024 Advanced",
    "description": "Advanced students in spring programs",
    "active": false,
    "profileIds": [
      "tspr1wv3-84qm-emoq-5u6b-gf2w8nxr74l"
    ]
  }
];

// EVALCHATFEEDBACKS MOCK DATA
export const evalChatFeedbacks = [
  {
    "id": "v560vezk-au9m-5g2x-6uou-qnsiotodtgp",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "standardId": "standardId_1",
    "evalChatGradeId": "evalChatGradeId_1",
    "total": 73,
    "feedback": "feedback_1"
  }
];

// EVALCHATS MOCK DATA
export const evalChats = [
  {
    "id": "10qqtxdx-vy8i-9bf4-4gfm-fg3npghfnwu",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "completedAt": "2025-06-19T01:16:59.431Z",
    "title": "Eval_chats 1",
    "scenarioId": "scenarioId_1",
    "evalRunId": "evalRunId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// EVALRUNS MOCK DATA
export const evalRuns = [
  {
    "id": "7jnoo932-ehbb-vagz-kxke-leejhhh9yl",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "evalId": "evalId_1",
    "agentId": "agentId_1",
    "rubricId": "rubricId_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "pnaojz1b-sf5d-e1ke-lu6f-r6zfgcnow5",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.88,
    "defaultAgent": "defaultAgent_1"
  },
  {
    "id": "iintt0kq-380i-fkwn-ph90-im44stmqwyp",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.47,
    "defaultAgent": "defaultAgent_2"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "ppfhsbfa-af5b-sbbh-so2o-78mu0k6laj",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-06-19T01:16:59.431Z",
    "scheduleId": "scheduleId_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "zgpgxba8-6qe1-287x-6iu4-kvt5vtc8sqm",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "sv6nwe7u-lmem-kfpw-6fdj-h2yx2n6rao9",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "dj04ianc-a6gb-zjd0-e7pt-csuckuxmbms",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// EVALMESSAGES MOCK DATA
export const evalMessages = [
  {
    "id": "m6xpct07-6eo4-o2ui-osd0-ng5d2bxkozs",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "kk9moezv-xo6j-q39h-xezs-2k0dqyzo5pc",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "tspr1wv3-84qm-emoq-5u6b-gf2w8nxr74l",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "userId": "userId_1",
    "lastLogin": "2025-06-19T01:16:59.431Z",
    "firstName": "John",
    "lastName": "Doe",
    "alias": "user1",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "role": "admin",
    "classIds": [
      "sv6nwe7u-lmem-kfpw-6fdj-h2yx2n6rao9",
      "dj04ianc-a6gb-zjd0-e7pt-csuckuxmbms"
    ]
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 70,
    "userId": 100,
    "expires": "2025-06-19T01:16:59.431Z",
    "sessionToken": "sessionToken_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "7mhr4mqx-cik6-vng9-k3sq-ugqzhr9cx1h",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "chatId": "chatId_1",
    "query": "query_1",
    "response": "response_1",
    "completed": true
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "uhecfh30-t8p6-awcj-nner-2l9uj8ah5af",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 97,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "08971ojs-h4d5-7daw-gsgs-iznggs2r5ve",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "passed": true,
    "score": 45,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "jvmlq8sb-kp6v-qx9a-xldd-rxj94xay37h",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "nsp2rwl3-t63o-zmqz-vb0g-syx4g9lqmw",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "1md0bd8o-ohpr-w95e-u4ps-3rlznpy9j6k",
      "yfeoo2o2-fkld-x3cq-dfyd-0t9hpp5e9ncb"
    ],
    "cohortIds": [
      "5cvb5jgf-yj5j-7rl4-7h0t-gt457esdd3r",
      "vfjyb03z-stgn-elgc-bw0g-xq2f7isot38"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "xph6p2dv-d0sz-qdhm-jrh5-94q908czw4v",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "1md0bd8o-ohpr-w95e-u4ps-3rlznpy9j6k",
      "yfeoo2o2-fkld-x3cq-dfyd-0t9hpp5e9ncb"
    ],
    "cohortIds": [
      "5cvb5jgf-yj5j-7rl4-7h0t-gt457esdd3r",
      "vfjyb03z-stgn-elgc-bw0g-xq2f7isot38"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "gyzynwxe-yzpw-6yud-ouog-9siuuij0whc",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 59,
    "name": "Users 1",
    "email": "user1@example.com",
    "emailVerified": "2025-06-19T01:16:59.431Z",
    "image": "image_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "6dhdhbc4-f1xe-iuu9-zsub-rt2gmyrkib",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true,
    "fileId": "fileId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "as1d70h2-z5qj-ppf5-8194-kugkzot7lw",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 67,
    "standardGroupId": "standardGroupId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "nou7xr63-2ql2-cis2-ffbc-br13fpc7gcj",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 36,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "hdyqoh46-iizt-osas-0n4z-qnt1l0xz1dj",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 75,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "1md0bd8o-ohpr-w95e-u4ps-3rlznpy9j6k",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "classId": "classId_1",
    "crowdedness": 1,
    "intensity": 99,
    "seniority": "freshman",
    "defaultScenario": "defaultScenario_1"
  },
  {
    "id": "yfeoo2o2-fkld-x3cq-dfyd-0t9hpp5e9ncb",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "updatedAt": "2025-06-19T01:16:59.431Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 69,
    "seniority": "sophomore",
    "defaultScenario": "defaultScenario_2"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "sktgznbj-so5d-t24u-mkmp-byj3rjmsktr",
    "createdAt": "2025-06-19T01:16:59.431Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 53,
    "feedback": "feedback_1"
  }
];

// MIGRATIONS MOCK DATA
export const migrations = [
  {
    "id": 69,
    "hash": "hash_1",
    "createdAt": 67
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-06-19T01:16:59.431Z",
    "token": "token_1"
  }
];

