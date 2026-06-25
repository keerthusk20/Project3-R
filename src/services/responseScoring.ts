export const scoreResponse = (response: string, query: string, context?: any) => {
    // Basic mock scoring
    return {
        overall: 0.9,
        relevance: 0.9,
        helpfulness: 0.9,
        completeness: 0.9,
        accuracy: 0.9
    };
};

export const getImprovementSuggestions = (scores: any) => {
    return [
        "Include more direct links to government portals.",
        "Add clearer formatting with bullet points."
    ];
};
