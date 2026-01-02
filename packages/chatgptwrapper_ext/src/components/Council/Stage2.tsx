import { useState } from 'react';
import { marked } from 'marked';
import type { Stage2Result, AggregateRanking, ResponseEvaluation } from '../../store/councilStore';
import { LLM_CONFIG, type LLMType } from '../../config/llm';

interface Stage2Props {
  rankings: Stage2Result[];
  labelToModel?: Record<string, { model: string; llmType: LLMType }>;
  aggregateRankings?: AggregateRanking[];
}

function deAnonymizeText(
  text: string,
  labelToModel?: Record<string, { model: string; llmType: LLMType }>
): string {
  if (!labelToModel) return text;

  let result = text;
  Object.entries(labelToModel).forEach(([label, { model }]) => {
    result = result.replace(new RegExp(label, 'g'), `**${model}**`);
  });
  return result;
}

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const percentage = (score / max) * 100;
  const color = score >= 4 ? '#22c55e' : score >= 3 ? '#eab308' : '#ef4444';

  return (
    <div className="score-bar">
      <div className="score-bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
      <span className="score-value">{score}/{max}</span>
    </div>
  );
}

function EvaluationCard({
  evaluation,
  labelToModel
}: {
  evaluation: ResponseEvaluation;
  labelToModel?: Record<string, { model: string; llmType: LLMType }>;
}) {
  const modelInfo = labelToModel?.[evaluation.responseLabel];
  const modelConfig = modelInfo ? LLM_CONFIG[modelInfo.llmType] : null;

  return (
    <div className="evaluation-card">
      <div className="evaluation-header">
        <span
          className="evaluation-model"
          style={{ color: modelConfig?.color || '#666' }}
        >
          {modelConfig?.icon} {modelInfo?.model || evaluation.responseLabel}
        </span>
        <span className="evaluation-total">
          Total: <strong>{evaluation.totalScore}/25</strong>
        </span>
      </div>

      {evaluation.scores.length > 0 && (
        <table className="scores-table">
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Score</th>
              <th>Assessment</th>
            </tr>
          </thead>
          <tbody>
            {evaluation.scores.map((score, i) => (
              <tr key={i}>
                <td className="criterion-name">{score.criterion}</td>
                <td className="criterion-score">
                  <ScoreBar score={score.score} />
                </td>
                <td className="criterion-assessment">{score.assessment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="evaluation-details">
        {evaluation.strengths.length > 0 && (
          <div className="eval-section strengths">
            <h5>Strengths</h5>
            <ul>
              {evaluation.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.weaknesses.length > 0 && (
          <div className="eval-section weaknesses">
            <h5>Weaknesses</h5>
            <ul>
              {evaluation.weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.pointsAdded && evaluation.pointsAdded.length > 0 && (
          <div className="eval-section points-added">
            <h5>Points Added</h5>
            <ul>
              {evaluation.pointsAdded.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.pointsDocked.length > 0 && (
          <div className="eval-section points-docked">
            <h5>Points Docked</h5>
            <ul>
              {evaluation.pointsDocked.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function Stage2({ rankings, labelToModel, aggregateRankings }: Stage2Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [showRaw, setShowRaw] = useState(false);

  if (!rankings || rankings.length === 0) {
    return null;
  }

  const activeRanking = rankings[activeTab];
  const config = LLM_CONFIG[activeRanking.llmType];
  const hasEvaluations = activeRanking.evaluations && activeRanking.evaluations.length > 0;

  return (
    <div className="council-stage stage2">
      <h3 className="stage-title">Stage 2: Peer Rankings</h3>

      <p className="stage-description">
        Each model evaluated all responses (anonymized as Response A, B, C) with structured scores.
      </p>

      <div className="stage-tabs">
        {rankings.map((rank, index) => {
          const tabConfig = LLM_CONFIG[rank.llmType];
          return (
            <button
              key={index}
              className={`stage-tab ${activeTab === index ? 'active' : ''}`}
              style={{ '--tab-color': tabConfig.color } as React.CSSProperties}
              onClick={() => setActiveTab(index)}
            >
              <span className="tab-icon">{tabConfig.icon}</span>
              {tabConfig.name}
            </button>
          );
        })}
      </div>

      <div className="stage-content" style={{ borderTopColor: config.color }}>
        <div className="stage-content-header">
          <div className="model-badge" style={{ backgroundColor: config.color }}>
            {config.name}'s Evaluation
          </div>
          {hasEvaluations && (
            <button
              className="toggle-view-btn"
              onClick={() => setShowRaw(!showRaw)}
            >
              {showRaw ? 'Show Parsed' : 'Show Raw'}
            </button>
          )}
        </div>

        {showRaw || !hasEvaluations ? (
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={{
              __html: marked(deAnonymizeText(activeRanking.ranking, labelToModel))
            }}
          />
        ) : (
          <div className="evaluations-grid">
            {activeRanking.evaluations.map((evaluation, i) => (
              <EvaluationCard
                key={i}
                evaluation={evaluation}
                labelToModel={labelToModel}
              />
            ))}
          </div>
        )}

        {activeRanking.parsedRanking && activeRanking.parsedRanking.length > 0 && (
          <div className="parsed-ranking">
            <strong>Final Ranking:</strong>
            <ol>
              {activeRanking.parsedRanking.map((label, i) => {
                const modelInfo = labelToModel?.[label];
                const evalData = activeRanking.evaluations?.find(e => e.responseLabel === label);
                return (
                  <li key={i}>
                    {modelInfo ? (
                      <span
                        className="ranked-model"
                        style={{ color: LLM_CONFIG[modelInfo.llmType].color }}
                      >
                        {modelInfo.model}
                      </span>
                    ) : (
                      label
                    )}
                    {evalData && (
                      <span className="rank-score-inline">
                        ({evalData.totalScore}/25)
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {aggregateRankings && aggregateRankings.length > 0 && (
        <div className="aggregate-rankings">
          <h4>Aggregate Rankings (Street Cred)</h4>
          <p className="stage-description">
            Combined results across all peer evaluations (lower rank = better):
          </p>
          <div className="aggregate-list">
            {aggregateRankings.map((agg, index) => {
              const aggConfig = LLM_CONFIG[agg.llmType];
              return (
                <div key={index} className="aggregate-item">
                  <span className="rank-position">#{index + 1}</span>
                  <span
                    className="rank-model"
                    style={{ color: aggConfig.color }}
                  >
                    {aggConfig.icon} {agg.model}
                  </span>
                  <span className="rank-score">
                    Avg Rank: {agg.averageRank.toFixed(2)}
                  </span>
                  <span className="rank-count">
                    ({agg.rankingsCount} votes)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
