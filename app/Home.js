import React from "react";
import topics from "../topics";

function Home() {
  const now = new Date();

  // 現在の時間に基づいて公開中のお題を選択
  const currentTopic = [...topics].reverse().find(topic => {
    return new Date(topic.startDate) <= now;
  });

  return (
    <div>
      <h1>現在公開中のお題</h1>
      {currentTopic ? (
        <div>
          <h2>{currentTopic.title}</h2>
          <p>{currentTopic.description}</p>
        </div>
      ) : (
        <p>まだお題は公開されていません。</p>
      )}
    </div>
  );
}

export default Home;
