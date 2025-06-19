// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 52,
    "userId": 52,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "mode": "mode_1",
    "expiresAt": 73,
    "sessionState": "sessionState_1",
    "tokenType": "tokenType_1"
  }
];

// EVALS MOCK DATA
export const evals = [
  {
    "id": "ll6myv20-u214-m8im-5src-skzlzzusg8",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Math Skills Evaluation",
    "description": "Comprehensive evaluation of mathematical problem-solving abilities",
    "baseAgentId": "baseAgentId_1",
    "scenarioIds": [
      "zanxipoz-i714-gpaj-8r6q-g5dn9hy6cq",
      "gbtxo01c-io07-uei2-sv3o-uup0htqpdya"
    ],
    "agentIds": [
      "eq5tbq1k-g5pw-cxi1-av5x-kpufj04qp5",
      "9z9g7slc-2our-zudt-bj68-yqejmdfx7x"
    ],
    "rubricIds": [
      "fboyxyd3-6o88-zwec-2jpx-faae2nwxe6o",
      "qi03myyx-ut2n-5w63-ejln-v7pb2amb93h"
    ],
    "maxTurns": "maxTurns_1",
    "startOnCreation": "startOnCreation_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "zb2fz4qt-nw3h-dyeq-7xjn-3ld4jqev8wd",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "1n7te4lf-042s-6xsg-8zlh-xit9lwkaa6h",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
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
    "id": 12,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-06-19T01:12:08.642Z"
  }
];

// EVALCHATGRADES MOCK DATA
export const evalChatGrades = [
  {
    "id": "90k34ezl-1mu6-qf56-zr5d-mcb18ynxts",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "passed": false,
    "score": 19,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "evalChatId": "evalChatId_1"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "7sheue6c-fa5s-gh7s-2vcn-kwoztrhn2w",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "title": "Fall 2024 Cohort",
    "active": true,
    "profileIds": [
      "h80hvr7h-ymup-8r2r-0tk5-c20bw12oy2r"
    ]
  },
  {
    "id": "jgdnoumm-cn5l-08sk-5xst-bzol3oiuiyw",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "h80hvr7h-ymup-8r2r-0tk5-c20bw12oy2r"
    ]
  }
];

// EVALCHATFEEDBACKS MOCK DATA
export const evalChatFeedbacks = [
  {
    "id": "9fhhmtjv-z1rg-6ir5-41uy-xwpdahx535l",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "standardId": "standardId_1",
    "evalChatGradeId": "evalChatGradeId_1",
    "total": 52,
    "feedback": "feedback_1"
  }
];

// EVALCHATS MOCK DATA
export const evalChats = [
  {
    "id": "aflys0wz-n76y-2qtl-vapk-7h90kc2nk2i",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "completedAt": "2025-06-19T01:12:08.642Z",
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
    "id": "kht19qrj-x8aa-x4m0-7yzo-jzhjrnha8wq",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "evalId": "evalId_1",
    "agentId": "agentId_1",
    "rubricId": "rubricId_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "eq5tbq1k-g5pw-cxi1-av5x-kpufj04qp5",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.53,
    "defaultAgent": "defaultAgent_1"
  },
  {
    "id": "9z9g7slc-2our-zudt-bj68-yqejmdfx7x",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.33,
    "defaultAgent": "defaultAgent_2"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "mxhrne70-gias-g3s1-rsfy-qxrojmz5ffa",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-06-19T01:12:08.642Z",
    "scheduleId": "scheduleId_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "9tdfhs0y-fwoj-4gv9-ioek-bybkdghe3i",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "ps7yhjdo-4as5-ywjd-c08n-e4gbs0ij7je",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "g2a3qpc4-azil-v6wy-q18w-736xou6iyvc",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
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
    "id": "6qqlchcz-y04m-xegy-phyr-pzphbq32pq",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "j8m4jr7k-vo1j-2dn6-r5wk-a8ke2ad8fca",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "h80hvr7h-ymup-8r2r-0tk5-c20bw12oy2r",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "lastLogin": "2025-06-19T01:12:08.642Z",
    "firstName": "John",
    "lastName": "Doe",
    "alias": "user1",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "role": "admin",
    "classIds": [
      "ps7yhjdo-4as5-ywjd-c08n-e4gbs0ij7je",
      "g2a3qpc4-azil-v6wy-q18w-736xou6iyvc"
    ]
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 84,
    "userId": 96,
    "expires": "2025-06-19T01:12:08.642Z",
    "sessionToken": "sessionToken_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "j1bf9zpp-4url-flab-30cd-iojnog7d2u",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "chatId": "chatId_1",
    "query": "query_1",
    "response": "response_1",
    "completed": true
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "4hci9504-435e-lxde-jyro-sxvpx2zdogf",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 21,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "2cys6mbr-lgdm-soss-xnr4-ejiqapvotsh",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "passed": true,
    "score": 42,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "ojan8dis-j18j-f4o3-crcm-7kete8n04wa",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "ei6c1n9l-s1bx-ee36-k68e-6bnmxcy9cji",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "zanxipoz-i714-gpaj-8r6q-g5dn9hy6cq",
      "gbtxo01c-io07-uei2-sv3o-uup0htqpdya"
    ],
    "cohortIds": [
      "7sheue6c-fa5s-gh7s-2vcn-kwoztrhn2w",
      "jgdnoumm-cn5l-08sk-5xst-bzol3oiuiyw"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "p90czr8t-ftbf-fe89-egn8-3isnk0c3gkl",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "title": "Lab Safety Training",
    "active": false,
    "scenarioIds": [
      "zanxipoz-i714-gpaj-8r6q-g5dn9hy6cq",
      "gbtxo01c-io07-uei2-sv3o-uup0htqpdya"
    ],
    "cohortIds": [
      "7sheue6c-fa5s-gh7s-2vcn-kwoztrhn2w",
      "jgdnoumm-cn5l-08sk-5xst-bzol3oiuiyw"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "mixouc4p-8s7p-yiox-nf34-ee91dtzaa3a",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 63,
    "email": "user1@example.com",
    "emailVerified": "2025-06-19T01:12:08.642Z"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "ryr87sig-3o3c-j2lq-bmvy-gbzp7k9xmwt",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": true
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "q25v3iv2-u31y-jpaf-cmiu-rzmdomdnhm",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 25,
    "standardGroupId": "standardGroupId_1"
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "fboyxyd3-6o88-zwec-2jpx-faae2nwxe6o",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 42,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "qi03myyx-ut2n-5w63-ejln-v7pb2amb93h",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 90,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "zanxipoz-i714-gpaj-8r6q-g5dn9hy6cq",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 95,
    "intensity": 15,
    "seniority": "freshman",
    "defaultScenario": "defaultScenario_1"
  },
  {
    "id": "gbtxo01c-io07-uei2-sv3o-uup0htqpdya",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "updatedAt": "2025-06-19T01:12:08.642Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "crowdedness": 15,
    "intensity": 36,
    "seniority": "sophomore",
    "defaultScenario": "defaultScenario_2"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "zxt36h7v-g101-v2q0-vzgx-d0kzth2gjb",
    "createdAt": "2025-06-19T01:12:08.642Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 50,
    "feedback": "feedback_1"
  }
];

// MIGRATIONS MOCK DATA
export const migrations = [
  {
    "id": 71,
    "hash": "hash_1",
    "mode": "mode_1",
    "createdAt": 76
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-06-19T01:12:08.642Z",
    "token": "token_1"
  }
];

