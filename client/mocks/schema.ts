// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

// CLASSES MOCK DATA
export const classes = [
  {
    "id": "7jxrg8ik-cxoo-wy89-2htz-24jj9xlprdv",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Algebra I",
    "classCode": "MATH101",
    "year": 2024,
    "term": "fall",
    "description": "Introduction to algebraic concepts and problem solving",
    "defaultClass": "defaultClass_1"
  },
  {
    "id": "d8h5j2m3-hj6k-85au-71wo-0bhglfpep9b7",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "General Chemistry",
    "classCode": "CHEM101",
    "year": 2024,
    "term": "spring",
    "description": "Basic principles of chemistry and lab techniques",
    "defaultClass": "defaultClass_2"
  }
];

// TOPICS MOCK DATA
export const topics = [
  {
    "id": "67izrbae-9t1z-xdpb-18xk-rx498jn1uo",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Topics 1",
    "description": "Description for topics 1",
    "prerequisite": false,
    "classId": "classId_1"
  }
];

// SCHEDULES MOCK DATA
export const schedules = [
  {
    "id": "jeeexo5i-1xqc-phgz-bvlx-leloi7vsqy",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Schedules 1",
    "description": "Description for schedules 1",
    "classId": "classId_1"
  }
];

// EVENTS MOCK DATA
export const events = [
  {
    "id": "p4341068-tdo7-jpk8-5rbq-0y1fvtuzx0g",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Events 1",
    "description": "Description for events 1",
    "documentType": "documentType_1",
    "time": "2025-06-24T16:36:59.322Z",
    "scheduleId": "scheduleId_1"
  }
];

// DOCUMENTS MOCK DATA
export const documents = [
  {
    "id": "f5ys4zpw-gqwg-ci7l-t53j-f6f9x5mbedj",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Documents 1",
    "filePath": "filePath_1",
    "mimeType": "mimeType_1",
    "classId": "classId_1",
    "type": "homework",
    "classified": false,
    "fileId": "fileId_1"
  }
];

// PROVIDERS MOCK DATA
export const providers = [
  {
    "id": "z0n92hr4-z9ep-1bu6-iafn-4toqm5y5inb",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Providers 1",
    "description": "Description for providers 1",
    "apiKey": "apiKey_1"
  }
];

// ACCOUNTS MOCK DATA
export const accounts = [
  {
    "id": 27,
    "userId": 73,
    "type": "type_1",
    "provider": "provider_1",
    "providerAccountId": "providerAccountId_1",
    "refreshToken": "refreshToken_1",
    "accessToken": "accessToken_1",
    "mode": "mode_1",
    "expiresAt": 91,
    "idToken": "idToken_1",
    "scope": "scope_1",
    "tokenType": "tokenType_1"
  }
];

// SESSIONS MOCK DATA
export const sessions = [
  {
    "id": 73,
    "userId": 40,
    "expires": "2025-06-24T16:36:59.322Z",
    "sessionToken": "sessionToken_1"
  }
];

// MODELS MOCK DATA
export const models = [
  {
    "id": "wudjcs0x-nbza-cu82-c9jf-tuzi3ubqcul",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Models 1",
    "description": "Description for models 1",
    "providerId": "providerId_1",
    "active": true
  }
];

// USERS MOCK DATA
export const users = [
  {
    "id": 2,
    "name": "Admin User",
    "emailVerified": "2025-06-24T16:36:59.322Z"
  },
  {
    "id": 86,
    "email": "instructional@example.com",
    "emailVerified": "2025-06-24T16:36:59.322Z",
    "image": "image_2"
  },
  {
    "id": 93,
    "email": "instructor@example.com",
    "emailVerified": "2025-06-24T16:36:59.322Z"
  },
  {
    "id": 70,
    "name": "TA User",
    "email": "ta@example.com",
    "emailVerified": "2025-06-24T16:36:59.322Z",
    "image": "image_4"
  }
];

// PROFILES MOCK DATA
export const profiles = [
  {
    "id": "m3mgko1y-bfcm-xxyw-kmm6-laspn2m5b2a",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "userId": 2,
    "lastLogin": "2025-06-24T16:36:59.322Z",
    "firstName": "Admin",
    "lastName": "User",
    "alias": "admin-user",
    "viewedIntro": "viewedIntro_1",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "role": "admin",
    "classIds": [
      "7jxrg8ik-cxoo-wy89-2htz-24jj9xlprdv",
      "d8h5j2m3-hj6k-85au-71wo-0bhglfpep9b7"
    ]
  },
  {
    "id": "vuh6a4gk-tb5i-2hjv-laxk-nqh5ncmxwi",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "userId": 86,
    "lastLogin": "2025-06-24T16:36:59.322Z",
    "firstName": "Instructional",
    "lastName": "User",
    "alias": "instructional-user",
    "viewedIntro": "viewedIntro_2",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "role": "instructional",
    "classIds": [
      "7jxrg8ik-cxoo-wy89-2htz-24jj9xlprdv",
      "d8h5j2m3-hj6k-85au-71wo-0bhglfpep9b7"
    ]
  },
  {
    "id": "4lx9hn7f-ldu7-mur1-7oiv-9gnmwym8dgv",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "userId": 93,
    "lastLogin": "2025-06-24T16:36:59.322Z",
    "firstName": "Instructor",
    "lastName": "User",
    "alias": "instructor-user",
    "viewedIntro": "viewedIntro_3",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "role": "instructor",
    "classIds": [
      "7jxrg8ik-cxoo-wy89-2htz-24jj9xlprdv",
      "d8h5j2m3-hj6k-85au-71wo-0bhglfpep9b7"
    ]
  },
  {
    "id": "43b6ckz7-i56m-6823-w1vj-t1uwk8ax71",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "userId": 70,
    "lastLogin": "2025-06-24T16:36:59.322Z",
    "firstName": "TA",
    "lastName": "User",
    "alias": "ta-user",
    "viewedIntro": "viewedIntro_4",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "role": "ta",
    "classIds": [
      "7jxrg8ik-cxoo-wy89-2htz-24jj9xlprdv",
      "d8h5j2m3-hj6k-85au-71wo-0bhglfpep9b7"
    ]
  }
];

// RUBRICS MOCK DATA
export const rubrics = [
  {
    "id": "ujpql6mz-7ho3-ns0a-bdw8-epp6e1kbva",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Math Problem Solving Rubric",
    "description": "Evaluates mathematical reasoning and problem-solving skills",
    "points": 17,
    "passPoints": "passPoints_1",
    "defaultRubric": "defaultRubric_1"
  },
  {
    "id": "lnmfkfm0-g6es-pbi5-60s9-dk5wd13mz5g",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Science Lab Rubric",
    "description": "Assesses lab technique and safety knowledge",
    "points": 21,
    "passPoints": "passPoints_2",
    "defaultRubric": "defaultRubric_2"
  }
];

// STANDARDGROUPS MOCK DATA
export const standardGroups = [
  {
    "id": "nziy1fbd-ue2l-kwuh-mk56-u26l176zfu",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "name": "Standard_groups 1",
    "shortName": "shortName_1",
    "description": "Description for standard_groups 1",
    "points": 94,
    "passPoints": "passPoints_1",
    "rubricId": "rubricId_1"
  }
];

// STANDARDS MOCK DATA
export const standards = [
  {
    "id": "c2xh8j1t-hobn-0qxe-b81k-phgav738jw",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "name": "Standards 1",
    "description": "Description for standards 1",
    "points": 27,
    "standardGroupId": "standardGroupId_1"
  }
];

// APPLOGS MOCK DATA
export const appLogs = [
  {
    "id": 90,
    "level": "level_1",
    "message": "message_1",
    "context": {},
    "createdAt": "2025-06-24T16:36:59.322Z"
  }
];

// ASSISTANTCHATS MOCK DATA
export const assistantChats = [
  {
    "id": "nroos4qo-uc0i-1hh2-47p6-8k8ezkjvucf",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "title": "Assistant_chats 1",
    "profileId": "profileId_1",
    "traceId": "traceId_1"
  }
];

// ASSISTANTMESSAGES MOCK DATA
export const assistantMessages = [
  {
    "id": "3ls9uch0-o0ga-tvvd-86xw-yfv5d78t4rn",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "completedAt": "2025-06-24T16:36:59.322Z",
    "chatId": "chatId_1",
    "role": "user",
    "content": "content_1",
    "completed": false
  }
];

// ASSISTANTTOOLCALLS MOCK DATA
export const assistantToolCalls = [
  {
    "id": "e7pzx151-sli4-kwe3-h6j5-it1fj5bm7ao",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "completedAt": "2025-06-24T16:36:59.322Z",
    "chatId": "chatId_1",
    "toolName": "toolName_1",
    "toolType": "toolType_1",
    "toolArguments": "toolArguments_1",
    "toolResult": "toolResult_1",
    "completed": false
  }
];

// COMPONENTS MOCK DATA
export const components = [
  {
    "id": "p4m16al2-mgoq-xj8s-bp7j-13fwzz9bs5rb",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Components 1",
    "description": "Description for components 1",
    "fileName": "fileName_1",
    "layout": {},
    "stat": true,
    "defaultComponent": "defaultComponent_1"
  }
];

// SCENARIOS MOCK DATA
export const scenarios = [
  {
    "id": "jcvevohz-4cpi-hcqg-04co-8uwk07ajwri",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Algebra Problem Solving",
    "description": "Students work through complex algebra problems with AI assistance",
    "agentId": "agentId_1",
    "classId": "classId_1",
    "crowdedness": 8,
    "intensity": 48,
    "seniority": "freshman",
    "defaultScenario": "defaultScenario_1"
  },
  {
    "id": "g5skpfiu-j44f-9uua-k37w-91fw0hjx5pk",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Chemistry Lab Safety",
    "description": "Students learn lab safety protocols through interactive scenarios",
    "agentId": "agentId_2",
    "classId": "classId_2",
    "crowdedness": 15,
    "intensity": 31,
    "defaultScenario": "defaultScenario_2"
  }
];

// DASHBOARDS MOCK DATA
export const dashboards = [
  {
    "id": "2659z8jj-ijua-wuak-jdi9-vpnca4hvfof",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
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
    "mainSplit": "mainSplit_1",
    "footerSplit": "footerSplit_1"
  }
];

// AGENTS MOCK DATA
export const agents = [
  {
    "id": "auqhgsgf-pihl-alqk-erwl-msukrbqi1e",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Math Tutor Agent",
    "description": "Helps students with mathematical concepts and problem-solving",
    "systemPrompt": "You are a helpful math tutor. Guide students through problems step by step.",
    "temperature": 0.83,
    "defaultAgent": "defaultAgent_1",
    "editable": true,
    "reasoning": "low"
  },
  {
    "id": "7n07zcat-sdlb-gblq-2yac-ryij6irbaw9",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Science Helper Bot",
    "description": "Assists with scientific inquiries and experiments",
    "systemPrompt": "You are a science assistant. Help students understand scientific concepts.",
    "temperature": 0.16,
    "defaultAgent": "defaultAgent_2",
    "editable": true,
    "modelId": "modelId_2",
    "reasoning": "medium"
  }
];

// COHORTS MOCK DATA
export const cohorts = [
  {
    "id": "8b7659u4-k63z-fizm-voe5-md0dpwf68i",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "title": "Fall 2024 Cohort",
    "description": "Students enrolled in fall semester courses",
    "active": true,
    "profileIds": [
      "m3mgko1y-bfcm-xxyw-kmm6-laspn2m5b2a",
      "vuh6a4gk-tb5i-2hjv-laxk-nqh5ncmxwi",
      "4lx9hn7f-ldu7-mur1-7oiv-9gnmwym8dgv",
      "43b6ckz7-i56m-6823-w1vj-t1uwk8ax71"
    ]
  },
  {
    "id": "hnfq6agb-lyf2-2fds-jpfg-p6tskl1f8he",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "title": "Spring 2024 Advanced",
    "active": false,
    "profileIds": [
      "m3mgko1y-bfcm-xxyw-kmm6-laspn2m5b2a",
      "vuh6a4gk-tb5i-2hjv-laxk-nqh5ncmxwi",
      "4lx9hn7f-ldu7-mur1-7oiv-9gnmwym8dgv",
      "43b6ckz7-i56m-6823-w1vj-t1uwk8ax71"
    ]
  }
];

// SIMULATIONS MOCK DATA
export const simulations = [
  {
    "id": "ci0z2c0w-lcnr-tol4-ybur-axl1eacg49u",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "title": "Math Practice Simulation",
    "active": true,
    "scenarioIds": [
      "jcvevohz-4cpi-hcqg-04co-8uwk07ajwri",
      "g5skpfiu-j44f-9uua-k37w-91fw0hjx5pk"
    ],
    "cohortIds": [
      "8b7659u4-k63z-fizm-voe5-md0dpwf68i",
      "hnfq6agb-lyf2-2fds-jpfg-p6tskl1f8he"
    ],
    "rubricId": "rubricId_1",
    "defaultSimulation": "defaultSimulation_1"
  },
  {
    "id": "6uqsff65-6kl3-eqzo-t8ij-jlghmf1akj9",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "title": "Lab Safety Training",
    "timeLimit": "timeLimit_2",
    "active": false,
    "scenarioIds": [
      "jcvevohz-4cpi-hcqg-04co-8uwk07ajwri",
      "g5skpfiu-j44f-9uua-k37w-91fw0hjx5pk"
    ],
    "cohortIds": [
      "8b7659u4-k63z-fizm-voe5-md0dpwf68i",
      "hnfq6agb-lyf2-2fds-jpfg-p6tskl1f8he"
    ],
    "rubricId": "rubricId_2",
    "defaultSimulation": "defaultSimulation_2"
  }
];

// SIMULATIONATTEMPTS MOCK DATA
export const simulationAttempts = [
  {
    "id": "ez4mt3fj-qvaq-p8g8-4vuj-hbye1b5szrh",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "profileId": "profileId_1",
    "simulationId": "simulationId_1"
  }
];

// SIMULATIONCHATS MOCK DATA
export const simulationChats = [
  {
    "id": "1b0pdayo-btym-zgdi-6v8n-974ebkfaex7",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "completedAt": "2025-06-24T16:36:59.322Z",
    "title": "Simulation_chats 1",
    "scenarioId": "scenarioId_1",
    "attemptId": "attemptId_1",
    "completed": true,
    "traceId": "traceId_1"
  }
];

// SIMULATIONMESSAGES MOCK DATA
export const simulationMessages = [
  {
    "id": "5gcmp4nz-4sz2-a70c-mv7r-fyq5ey87r2",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": true
  }
];

// SIMULATIONCHATGRADES MOCK DATA
export const simulationChatGrades = [
  {
    "id": "a5j02r35-pkd8-4bll-vje6-iodyqs66mj",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "passed": true,
    "score": 78,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "simulationChatId": "simulationChatId_1"
  }
];

// SIMULATIONCHATFEEDBACKS MOCK DATA
export const simulationChatFeedbacks = [
  {
    "id": "fkqe9vay-lz0z-z5xh-byo4-btzmoe33vwf",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "standardId": "standardId_1",
    "simulationChatGradeId": "simulationChatGradeId_1",
    "total": 31,
    "feedback": "feedback_1"
  }
];

// EVALS MOCK DATA
export const evals = [
  {
    "id": "btumor08-gi2i-9w6v-a6y2-eiu4bsie4",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "name": "Math Skills Evaluation",
    "description": "Comprehensive evaluation of mathematical problem-solving abilities",
    "baseAgentId": "baseAgentId_1",
    "scenarioIds": [
      "jcvevohz-4cpi-hcqg-04co-8uwk07ajwri",
      "g5skpfiu-j44f-9uua-k37w-91fw0hjx5pk"
    ],
    "agentIds": [
      "auqhgsgf-pihl-alqk-erwl-msukrbqi1e",
      "7n07zcat-sdlb-gblq-2yac-ryij6irbaw9"
    ],
    "rubricIds": [
      "ujpql6mz-7ho3-ns0a-bdw8-epp6e1kbva",
      "lnmfkfm0-g6es-pbi5-60s9-dk5wd13mz5g"
    ],
    "maxTurns": "maxTurns_1",
    "startOnCreation": "startOnCreation_1"
  }
];

// EVALRUNS MOCK DATA
export const evalRuns = [
  {
    "id": "jknic80t-zowa-4rvj-2qau-rg4wrxj5qp",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "evalId": "evalId_1",
    "agentId": "agentId_1",
    "rubricId": "rubricId_1"
  }
];

// EVALCHATS MOCK DATA
export const evalChats = [
  {
    "id": "vmmglhmq-r8l0-fh0j-z281-wosb8ozw0d",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "updatedAt": "2025-06-24T16:36:59.322Z",
    "completedAt": "2025-06-24T16:36:59.322Z",
    "title": "Eval_chats 1",
    "scenarioId": "scenarioId_1",
    "evalRunId": "evalRunId_1",
    "completed": true
  }
];

// EVALMESSAGES MOCK DATA
export const evalMessages = [
  {
    "id": "7sng27y8-dzj7-x2nh-m16l-uefywzv7kjk",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "chatId": "chatId_1",
    "content": "content_1",
    "type": "query",
    "completed": false
  }
];

// EVALCHATGRADES MOCK DATA
export const evalChatGrades = [
  {
    "id": "2049xuws-5966-d7pz-ci6i-viz6enyf6qq",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "passed": true,
    "score": 41,
    "timeTaken": "timeTaken_1",
    "rubricId": "rubricId_1",
    "evalChatId": "evalChatId_1"
  }
];

// EVALCHATFEEDBACKS MOCK DATA
export const evalChatFeedbacks = [
  {
    "id": "w6echp3k-qsdo-iwj4-ez5v-gjrk60nq94",
    "createdAt": "2025-06-24T16:36:59.322Z",
    "standardId": "standardId_1",
    "evalChatGradeId": "evalChatGradeId_1",
    "total": 95,
    "feedback": "feedback_1"
  }
];

// VERIFICATIONTOKEN MOCK DATA
export const verificationToken = [
  {
    "identifier": "identifier_1",
    "expires": "2025-06-24T16:36:59.322Z",
    "token": "token_1"
  }
];

