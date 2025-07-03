import React, { useState, useEffect } from 'react';
import { MessageCircle, Zap, Brain, Layers, ChevronRight } from 'lucide-react';

const CHOFFChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCompression, setShowCompression] = useState(false);
  const [compressionStats, setCompressionStats] = useState(null);
  const [cognitiveGrooves, setCognitiveGrooves] = useState([]);

  // Extract CHOFF patterns from text
  const extractCHOFFPatterns = (text) => {
    const patterns = [];
    const stateRegex = /\{state:([^}]+)\}/g;
    const contextRegex = /\[context:([^\]]+)\]/g;
    const patternRegex = /&pattern:([^|]+)\|([^|]+)\|/g;
    const flowRegex = /→|←|↔|↠|⇄/g;
    
    let match;
    while ((match = stateRegex.exec(text))) patterns.push({ type: 'state', value: match[1], index: match.index });
    while ((match = contextRegex.exec(text))) patterns.push({ type: 'context', value: match[1], index: match.index });
    while ((match = patternRegex.exec(text))) patterns.push({ type: 'pattern', value: match[1], state: match[2], index: match.index });
    while ((match = flowRegex.exec(text))) patterns.push({ type: 'flow', value: match[0], index: match.index });
    
    return patterns;
  };

  // Compress conversation to cognitive skeleton
  const compressConversation = () => {
    const skeleton = {
      grooves: [],
      stateTransitions: [],
      contextMarkers: [],
      patterns: [],
      prunedRefs: []
    };

    messages.forEach((msg, idx) => {
      const patterns = extractCHOFFPatterns(msg.content);
      
      // Extract state transitions
      const states = patterns.filter(p => p.type === 'state');
      if (states.length > 0) {
        states.forEach(state => {
          skeleton.stateTransitions.push({
            turn: idx,
            state: state.value,
            role: msg.role
          });
        });
      }

      // Extract contexts
      const contexts = patterns.filter(p => p.type === 'context');
      contexts.forEach(ctx => {
        if (!skeleton.contextMarkers.find(c => c.value === ctx.value)) {
          skeleton.contextMarkers.push({ value: ctx.value, firstSeen: idx });
        }
      });

      // Extract patterns
      const patternMarkers = patterns.filter(p => p.type === 'pattern');
      patternMarkers.forEach(p => {
        skeleton.patterns.push({ ...p, turn: idx });
      });

      // Prune non-essential content
      if (patterns.length === 0 && msg.content.length > 100) {
        skeleton.prunedRefs.push({
          ref: `msg_${idx}`,
          desc: `{content:${msg.role}|length:${msg.content.length}|summary:"${msg.content.substring(0, 50)}..."}`
        });
      }
    });

    // Identify cognitive grooves (repeated patterns)
    const stateSequences = [];
    for (let i = 0; i < skeleton.stateTransitions.length - 1; i++) {
      const sequence = `${skeleton.stateTransitions[i].state} → ${skeleton.stateTransitions[i + 1].state}`;
      const existing = stateSequences.find(s => s.sequence === sequence);
      if (existing) {
        existing.count++;
      } else {
        stateSequences.push({ sequence, count: 1 });
      }
    }
    
    skeleton.grooves = stateSequences.filter(s => s.count > 1);
    
    return skeleton;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context with CHOFF markup
      const conversationContext = messages.map(m => 
        `${m.role}: ${m.content}`
      ).join('\n\n');

      const prompt = `You are a helpful assistant that uses CHOFF (Cognitive Hoffman Compression Framework) notation to mark your cognitive states and patterns. CHOFF includes:
- State markers: {state:type} or {state:intensity|type1[0.8]|type2[0.3]|}
- Context markers: [context:type]
- Pattern markers: &pattern:type|status|
- Flow indicators: → (forward), ← (backward), ↔ (bidirectional), ↠ (transition)

Previous conversation:
${conversationContext}

User: ${input}

Please respond naturally while incorporating CHOFF markers to indicate your cognitive state, context, and thought patterns. Be subtle but meaningful with the markers.`;

      const response = await window.claude.complete(prompt);
      
      const assistantMessage = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);

      // Extract patterns from the new response
      const patterns = extractCHOFFPatterns(response);
      if (patterns.length > 0) {
        setCognitiveGrooves(prev => [...prev, ...patterns.filter(p => p.type === 'state' || p.type === 'pattern')]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '{state:error} I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompress = () => {
    const skeleton = compressConversation();
    const originalSize = JSON.stringify(messages).length;
    const compressedSize = JSON.stringify(skeleton).length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    setCompressionStats({
      original: originalSize,
      compressed: compressedSize,
      ratio: compressionRatio,
      skeleton
    });
    setShowCompression(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 font-sans">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-lg">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-8 h-8" />
          CHOFF Cognitive Compression Demo
        </h1>
        <p className="text-sm opacity-90 mt-2">
          Watch as cognitive patterns emerge and compress into grooves
        </p>
      </div>

      {/* Chat Messages */}
      <div className="bg-gray-50 border-x border-gray-200 h-96 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Start a conversation to see CHOFF patterns emerge...</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-lg p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="text-sm">{msg.content}</div>
                {msg.role === 'assistant' && extractCHOFFPatterns(msg.content).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs opacity-70">
                    <Zap className="w-3 h-3 inline mr-1" />
                    {extractCHOFFPatterns(msg.content).length} cognitive markers
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-3 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border border-gray-200 rounded-b-lg p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
          {messages.length > 2 && (
            <button
              onClick={handleCompress}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              Compress
            </button>
          )}
        </div>
      </div>

      {/* Compression View */}
      {showCompression && compressionStats && (
        <div className="mt-4 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Cognitive Compression Analysis</h3>
            <button
              onClick={() => setShowCompression(false)}
              className="text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="text-gray-500">Original Size:</span> {compressionStats.original} chars
            </div>
            <div>
              <span className="text-gray-500">Compressed Size:</span> {compressionStats.compressed} chars
            </div>
            <div>
              <span className="text-gray-500">Compression Ratio:</span> {compressionStats.ratio}% reduction
            </div>
            
            {compressionStats.skeleton.grooves.length > 0 && (
              <div className="mt-4">
                <h4 className="text-yellow-400 mb-2">Cognitive Grooves (Repeated Patterns):</h4>
                {compressionStats.skeleton.grooves.map((groove, idx) => (
                  <div key={idx} className="ml-4">
                    <ChevronRight className="w-3 h-3 inline" />
                    {groove.sequence} (×{groove.count})
                  </div>
                ))}
              </div>
            )}
            
            {compressionStats.skeleton.contextMarkers.length > 0 && (
              <div className="mt-4">
                <h4 className="text-yellow-400 mb-2">Context Anchors:</h4>
                {compressionStats.skeleton.contextMarkers.map((ctx, idx) => (
                  <div key={idx} className="ml-4">
                    [context:{ctx.value}]
                  </div>
                ))}
              </div>
            )}
            
            {compressionStats.skeleton.prunedRefs.length > 0 && (
              <div className="mt-4">
                <h4 className="text-yellow-400 mb-2">Pruned Content (Can be lazy-loaded):</h4>
                {compressionStats.skeleton.prunedRefs.map((ref, idx) => (
                  <div key={idx} className="ml-4 text-gray-600">
                    {ref.ref}: {ref.desc}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CHOFFChatbot;