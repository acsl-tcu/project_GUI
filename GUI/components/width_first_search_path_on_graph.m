% Assumed environment
%            8
%            |
% 1 -------- 2 - 3 ----- 4
% |              |       |
% 5 ------------ 6 ----- 7
% "-" : length 1
% "|" : length 2
clear
clc
P = [[0,4];[20,4];[22,4];[40,4];[0,0];[22,0];[40,0];[20,6];[18,6]];
M = [[0, 1, 0, 0, 1, 0, 0, 0, 0]
    [1, 0, 1, 0, 0, 0, 0, 1, 0]
    [0, 1, 0, 1, 0, 1, 0, 0, 0]
    [0, 0, 1, 0, 0, 0, 1, 0, 0]
    [1, 0, 0, 0, 0, 1, 0, 0, 0]
    [0, 0, 1, 0, 1, 0, 1, 0, 0]
    [0, 0, 0, 1, 0, 1, 0, 0, 0]
    [0, 1, 0, 0, 0, 0, 0, 0, 1]
    [0, 0, 0, 0, 0, 0, 0, 1, 0]]; % 各ノードからいけるノードを表す。
%%
for i = 1:size(M,1)
i1=zeros(size(M,1),1);
i1(i) = 1;
Mi=find(M*i1);
M(Mi,i) = vecnorm(P(Mi,:)-P(i,:),2,2);
end
M
%%
% example 
% M(:,2) : [8 0 1 0 0 0 0 2]' 
% これは node 2 からいける nodeである1,3,8に値を持つ行列
% 各値はnode間距離（上図参照）

%% initialize lists
I = 1:size(M,1);% list of indices
V = zeros(size(I)); % value list
IV = [I;V]'; % valued index list : value is a minimum cost to reach the node

%% calc setting
start = 15; % nearest node : TODO : consider how to decide it
goal = 30;  % goal node : TODO : consider how to decide it
[seq,res] = gen_sequence(start,goal,M,IV);
disp(seq); % show the result
function [P,H]=gen_sequence(start,goal,M,IV)
ID = 1; % id
GEN= 2; % generation = tree depth
PN = 3; % parent number in generateion
NID= 4; % node id
VAL= 5; % value
ai = start; % current position
H = zeros(size(M,1)^2,5); % history
% H = [id, generation, parent number in generation, node index, value]
H(1,:) = [1,1,0,ai,0]; % initial
lH = 1; % number of history
for i = 2:size(M,1) % generation loop
    disp(["Generation : ",i]); % for debug
    ids = H(:,GEN)==i-1; % previous gen ids (logical vector)
    v0 = H(ids,NID); % previous vertices
    V0 = H(ids,VAL); % previous vertices' value 
    Vi = M(:,v0); % value from v0 to next vertices
    for col = 1:size(Vi,2) % loop for each previous vertex
        % col : focused vertex
        disp(["col : ",col]); % for debug
        lH = find(H(:,1)==0,1)-1; % number of history
        V = Vi(:,col); % value from v0(col) to next generation vi
        vi = find(V); % node connected from v0(col)
        ei = V~=0; % edge indices 
        V(ei) = V(ei) + V0(col); % value from start to vi 
        TV = IV(:,2); % Minimum vlue to each node
        
        % subs. large value(=1000) to 0 to compare
        TV(TV==0) = 1000;
        V(V==0) = 1000;

        mini=find(TV>V); % index to be replace the value
        IV(mini,2) = V(mini); % set/update value
        ids = (lH+1:lH+length(mini))'; % indices for set/update nodes
        H(ids,:) = [ids,repmat([i,col],length(ids),1),mini,V(mini)]; % log histroy
    end
    ngen = find(H(:,1)==0,1)-1-lH; % number of this generation
    lH = find(H(:,1)==0,1)-1; % number of history
    if ngen == 0 % break if there is no new node
        break;
    end
end
%% Find path from start to goal
nid = goal; % node index
id = H(:,NID)==nid; % id = row in H
gen = H(id,GEN); % generation to reach the goal with minimum path
P = zeros(1,gen); % path array
P(end) = goal; % set goal
for g = gen-1:-1:1 % from goal to start
    gid = H(:,GEN)==g; % indices of g-th generation
    tmp = H(gid,:);    % g-th gen history
    tmp = tmp(H(id,PN),:); % find the parent of current node
    nid = tmp(NID); % parent's node index
    id = tmp(ID); % parent's id in H
    P(g) = nid; % set parent as a node on the path
end
end
