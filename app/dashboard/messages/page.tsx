'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Hash,
  Send,
  Smile,
  Paperclip,
  Circle,
  MessageCircle,
  MoreVertical,
  Phone,
  Video,
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  Check,
  CheckCheck,
  Download
} from 'lucide-react';
import { useAuth } from '@/lib/parse-auth';
import { MessageHelpers, UserHelpers, ChannelHelpers, FileHelpers } from '@/lib/parse-helpers';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type UserStatus = {
  user_id: string;
  status: 'online' | 'offline' | 'away';
  last_seen: string;
};

type Channel = {
  id: string;
  name: string;
  description: string;
  type: 'department' | 'project' | 'general';
  created_by: string;
  created_at: string;
  is_member?: boolean;
};

type DirectMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: 'text' | 'file' | 'image';
  read: boolean;
  created_at: string;
  attachments: any;
  sender?: User;
};

type ChannelMessage = {
  id: string;
  sender_id: string;
  channel_id: string;
  content: string;
  type: 'text' | 'file' | 'image';
  created_at: string;
  attachments: any;
  sender?: User;
};

type Conversation = {
  user: User;
  last_message?: DirectMessage;
  unread_count: number;
};

export default function ModernMessagingPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'direct' | 'channels'>('direct');
  const [users, setUsers] = useState<User[]>([]);
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<User | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelType, setNewChannelType] = useState<'department' | 'project' | 'general'>('general');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedChannelMembers, setSelectedChannelMembers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [directMessages, channelMessages, scrollToBottom]);

  // Polling for updates instead of Realtime for now
  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      await Promise.all([
        fetchUsers(),
        fetchChannels(),
        fetchConversations()
      ]);

      if (selectedConversation) {
        fetchDirectMessages();
      }

      if (selectedChannel) {
        fetchChannelMessages();
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [profile, selectedConversation, selectedChannel]);

  const fetchUsers = async () => {
    try {
      const data = await UserHelpers.getAll();
      setUsers((data as unknown as User[]).filter((u) => u.id !== profile?.id));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchChannels = async () => {
    try {
      const allChannels = await ChannelHelpers.getAll();
      const channelsWithMembership = await Promise.all(
        allChannels.map(async (channel: any) => {
          const isMember = await ChannelHelpers.isMember(channel.id, profile?.id || '');
          return { ...channel, is_member: isMember };
        })
      );
      setChannels(channelsWithMembership as unknown as Channel[]);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const fetchConversations = async () => {
    // Simplified conversation fetching logic for Parse
    // In a real app, this would be optimized with Cloud Code
    try {
      const allUsers = await UserHelpers.getAll();
      const otherUsers = (allUsers as unknown as User[]).filter((u) => u.id !== profile?.id);

      const convs: Conversation[] = [];

      for (const user of otherUsers) {
        if (!profile?.id) continue;
        // Fetch last message
        const lastMsg = await MessageHelpers.getLastMessage(profile.id, user.id);
        const unreadCount = await MessageHelpers.countUnread(profile.id, user.id);

        if (lastMsg) {
          convs.push({
            user,
            last_message: lastMsg as DirectMessage,
            unread_count: unreadCount
          });
        }
      }

      setConversations(convs.sort((a, b) => {
        const dateA = new Date(a.last_message?.created_at || 0).getTime();
        const dateB = new Date(b.last_message?.created_at || 0).getTime();
        return dateB - dateA;
      }));
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchDirectMessages = async () => {
    if (!selectedConversation || !profile) return;
    try {
      const messages = await MessageHelpers.getConversation(profile.id, selectedConversation.id);
      setDirectMessages(messages as DirectMessage[]);

      // Mark as read
      await MessageHelpers.markAsRead(profile.id, selectedConversation.id);
    } catch (error) {
      console.error('Error fetching direct messages:', error);
    }
  };

  const fetchChannelMessages = async () => {
    if (!selectedChannel) return;
    try {
      const messages = await ChannelHelpers.getMessages(selectedChannel.id);
      setChannelMessages(messages as ChannelMessage[]);
    } catch (error) {
      console.error('Error fetching channel messages:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!profile) return null;

    try {
      setUploading(true);
      setUploadProgress(50);

      const parseFile = await FileHelpers.uploadFile(file);
      const url = FileHelpers.getFileUrl(parseFile);

      setUploadProgress(100);

      return {
        name: file.name,
        url: url,
        type: file.type,
        size: file.size
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload du fichier');
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingAttachment) || !selectedConversation || !profile) return;

    try {
      const messageData: any = {
        sender_id: profile.id,
        receiver_id: selectedConversation.id,
        content: newMessage.trim() || 'Fichier partagé',
        type: pendingAttachment ? (pendingAttachment.type?.startsWith('image/') ? 'image' : 'file') : 'text',
        is_read: false
      };

      if (pendingAttachment) {
        messageData.attachments = pendingAttachment;
      }

      await MessageHelpers.send(messageData);

      setNewMessage('');
      setPendingAttachment(null);
      fetchDirectMessages(); // Refresh immediately
      toast.success('✅ Message envoyé');
    } catch (error: any) {
      console.error('Erreur envoi message:', error);
      toast.error('Erreur lors de l\'envoi du message');
    }
  };

  const handleSendChannelMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingAttachment) || !selectedChannel || !profile) return;

    try {
      const messageData: any = {
        sender_id: profile.id,
        channel_id: selectedChannel.id,
        content: newMessage.trim() || 'Fichier partagé',
        type: pendingAttachment ? (pendingAttachment.type?.startsWith('image/') ? 'image' : 'file') : 'text'
      };

      if (pendingAttachment) {
        messageData.attachments = pendingAttachment;
      }

      await MessageHelpers.send(messageData);

      setNewMessage('');
      setPendingAttachment(null);
      fetchChannelMessages(); // Refresh immediately
      toast.success('✅ Message envoyé');
    } catch (error: any) {
      console.error('Erreur envoi message canal:', error);
      toast.error('Erreur lors de l\'envoi du message');
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !profile) {
      toast.error('Veuillez renseigner un nom de canal');
      return;
    }

    try {
      const newChannel = await ChannelHelpers.create({
        name: newChannelName.trim(),
        description: newChannelDescription.trim() || '',
        type: newChannelType,
        created_by: profile.id
      }) as unknown as Channel;

      // Add creator as admin
      await ChannelHelpers.addMember(newChannel.id, profile.id, 'admin');

      // Add other members
      for (const userId of selectedChannelMembers) {
        await ChannelHelpers.addMember(newChannel.id, userId, 'member');
      }

      toast.success(`✅ Canal #${newChannelName} créé avec succès`);
      setShowNewChannelDialog(false);
      setNewChannelName('');
      setNewChannelDescription('');
      setNewChannelType('general');
      setSelectedChannelMembers([]);
      fetchChannels();
    } catch (error: any) {
      console.error('Erreur création canal:', error);
      toast.error('Erreur lors de la création du canal');
    }
  };

  const handleStartConversation = async () => {
    if (!selectedUserId || !profile) return;

    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;

    setSelectedConversation(user);
    setShowNewConversationDialog(false);
    setSelectedUserId('');
    setActiveTab('direct');
    toast.success('Nouvelle conversation démarrée');
  };

  const handleJoinChannel = async (channel: Channel) => {
    if (!profile) return;

    try {
      await ChannelHelpers.addMember(channel.id, profile.id, 'member');
      toast.success(`✅ Vous avez rejoint #${channel.name}`);
      setSelectedChannel(channel);
      fetchChannels();
    } catch (error: any) {
      toast.error('Erreur lors de l\'adhésion au canal');
      console.error(error);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadedFile = await handleFileUpload(file);
    if (uploadedFile) {
      setPendingAttachment(uploadedFile);
      setNewMessage(file.type.startsWith('image/') ? '🖼️ Image' : `📎 ${uploadedFile.name}`);
      toast.success('Fichier prêt à envoyer');
    }
    // Reset input
    e.target.value = '';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: fr });
    } else if (isYesterday(date)) {
      return 'Hier';
    } else {
      return format(date, 'dd/MM', { locale: fr });
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter(conv =>
    conv.user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col rounded-3xl border border-border/60 bg-background/80 shadow-2xl shadow-primary/10 backdrop-blur">
      <div
        className="flex items-center justify-between gap-6 rounded-t-3xl border-b border-primary/20 px-6 py-8"
        style={{ background: 'linear-gradient(135deg, hsl(153 64% 26%) 0%, hsl(48 94% 62%) 100%)' }}
      >
        <div>
          <h1 className="text-3xl font-semibold text-primary-foreground">Messagerie PMN</h1>
          <p className="mt-2 text-sm font-medium text-primary-foreground/70">Communication en temps réel</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowNewConversationDialog(true)}
            className="gap-2 rounded-xl bg-primary-foreground text-primary font-semibold shadow-lg shadow-primary/30 transition-all hover:scale-[1.01] hover:bg-primary-foreground/90"
          >
            <Plus className="h-4 w-4" />
            Message
          </Button>
          <Button
            onClick={() => setShowNewChannelDialog(true)}
            variant="secondary"
            className="gap-2 rounded-xl shadow-lg shadow-secondary/30 transition-all hover:scale-[1.01]"
          >
            <Hash className="h-4 w-4" />
            Canal
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-80 flex-col border-r border-border/60 bg-background/70">
          <div className="space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-border bg-background"
              />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'direct' | 'channels')}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl bg-primary/10 p-1">
                <TabsTrigger value="direct" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <MessageCircle className="h-4 w-4" />
                  Messages
                </TabsTrigger>
                <TabsTrigger value="channels" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Hash className="h-4 w-4" />
                  Canaux
                </TabsTrigger>
              </TabsList>

              <TabsContent value="direct" className="mt-3">
                <div className="space-y-1 max-h-[calc(100vh-20rem)] overflow-y-auto">
                  {filteredConversations.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm font-medium text-foreground/60">Aucune conversation</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewConversationDialog(true)}
                        className="mt-2"
                      >
                        Démarrer une conversation
                      </Button>
                    </div>
                  ) : (
                    filteredConversations.map(conv => (
                      <div
                        key={conv.user.id}
                        onClick={() => {
                          setSelectedConversation(conv.user);
                          setSelectedChannel(null);
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-3 transition-all ${selectedConversation?.id === conv.user.id
                          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
                          : 'hover:bg-background/80'
                          }`}
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                              {getInitials(conv.user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-semibold text-foreground/90">
                              {conv.user.full_name}
                            </p>
                            {conv.last_message && (
                              <span className="text-xs font-medium text-foreground/50">
                                {formatTime(conv.last_message.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="truncate text-xs text-foreground/60">
                              {conv.last_message?.content || 'Démarrer une conversation'}
                            </p>
                            {conv.unread_count > 0 && (
                              <Badge className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="channels" className="mt-3">
                <div className="space-y-1 max-h-[calc(100vh-20rem)] overflow-y-auto">
                  {filteredChannels.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm font-medium text-foreground/60">Aucun canal</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewChannelDialog(true)}
                        className="mt-2"
                      >
                        Créer un canal
                      </Button>
                    </div>
                  ) : (
                    filteredChannels.map(channel => (
                      <div
                        key={channel.id}
                        onClick={() => {
                          if (channel.is_member) {
                            setSelectedChannel(channel);
                            setSelectedConversation(null);
                          } else {
                            handleJoinChannel(channel);
                          }
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-3 transition-all ${selectedChannel?.id === channel.id
                          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
                          : 'hover:bg-background/80'
                          }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-secondary-foreground">
                          <Hash className="h-5 w-5" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-semibold text-foreground/90">
                              {channel.name}
                            </p>
                            {!channel.is_member && (
                              <Badge variant="outline" className="text-[10px]">Rejoindre</Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-foreground/60">
                            {channel.description || 'Aucune description'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col bg-background/40">
          {(selectedConversation || selectedChannel) ? (
            <>
              <div className="flex items-center justify-between border-b border-border/60 bg-background/60 px-6 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  {selectedConversation ? (
                    <>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(selectedConversation.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="text-lg font-semibold">{selectedConversation.full_name}</h2>
                        <p className="text-xs text-muted-foreground">{selectedConversation.email}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-secondary-foreground">
                        <Hash className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">{selectedChannel?.name}</h2>
                        <p className="text-xs text-muted-foreground">{selectedChannel?.description}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Video className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {(selectedConversation ? directMessages : channelMessages).map((msg) => {
                  const isMe = msg.sender_id === profile?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex max-w-[70%] gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMe && (
                          <Avatar className="h-8 w-8 mt-1">
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                              {getInitials(msg.sender?.full_name || 'User')}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-3 shadow-sm ${isMe
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-white border border-border/50 rounded-tl-none'
                            }`}
                        >
                          {!isMe && selectedChannel && (
                            <p className="mb-1 text-xs font-bold text-primary/80">
                              {msg.sender?.full_name}
                            </p>
                          )}

                          {/* Render attachments */}
                          {msg.attachments && (
                            <div className="mb-2">
                              {msg.type === 'image' ? (
                                <img
                                  src={msg.attachments.url}
                                  alt={msg.attachments.name || 'Image'}
                                  className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition"
                                  onClick={() => window.open(msg.attachments.url, '_blank')}
                                />
                              ) : (
                                <a
                                  href={msg.attachments.url}
                                  download={msg.attachments.name}
                                  className="flex items-center gap-2 p-2 rounded bg-secondary/20 hover:bg-secondary/30 transition"
                                >
                                  <FileText className="h-4 w-4" />
                                  <span className="text-xs font-medium">{msg.attachments.name}</span>
                                  <Download className="h-3 w-3 ml-auto" />
                                </a>
                              )}
                            </div>
                          )}

                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            <span>{formatTime(msg.created_at)}</span>
                            {isMe && selectedConversation && (
                              (msg as DirectMessage).read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-border/60 bg-background/60 p-4 backdrop-blur-sm">
                {pendingAttachment && (
                  <div className="mb-2 flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    {pendingAttachment.type?.startsWith('image/') ? (
                      <ImageIcon className="h-4 w-4 text-blue-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="text-xs text-blue-900 font-medium flex-1">{pendingAttachment.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setPendingAttachment(null);
                        setNewMessage('');
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <form
                  onSubmit={selectedConversation ? handleSendDirectMessage : handleSendChannelMessage}
                  className="flex items-end gap-2"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full text-muted-foreground hover:bg-secondary/20 hover:text-secondary-foreground"
                    onClick={handleFileButtonClick}
                  >
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <div className="relative flex-1">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Écrivez votre message..."
                      className="pr-10 min-h-[2.5rem] py-3 rounded-xl border-border bg-background shadow-inner"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Smile className="h-5 w-5" />
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    disabled={!newMessage.trim() && !uploading}
                    className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <MessageCircle className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Vos messages</h2>
              <p className="mt-2 text-muted-foreground max-w-md">
                Sélectionnez une conversation ou un canal pour commencer à échanger avec vos collègues.
              </p>
              <Button onClick={() => setShowNewConversationDialog(true)} className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle conversation
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showNewConversationDialog} onOpenChange={setShowNewConversationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sélectionner un utilisateur</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un collègue" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleStartConversation} className="w-full" disabled={!selectedUserId}>
              Démarrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Channel Dialog would be similar */}
    </div>
  );
}
